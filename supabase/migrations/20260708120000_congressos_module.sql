-- =====================================================================
-- Módulo Congressos — Pré-Cadastro + Controle de Brindes + Cashback
-- Épico 1 / Story 1.1 — schema, enums, índices, RLS, RPCs, grants.
--
-- APLICAÇÃO: manual, via Supabase Dashboard → SQL Editor, APÓS o merge do PR.
-- (Migrations NÃO são aplicadas automaticamente no deploy.)
-- SEM BEGIN/COMMIT (o SQL Editor não suporta transação explícita).
-- Idempotente: seguro reexecutar (guards de enum, IF NOT EXISTS,
-- DROP POLICY IF EXISTS antes de CREATE POLICY, CREATE OR REPLACE).
--
-- IMPACTO MULTI-APP (banco compartilhado com adds-rep-app):
--   Seção 8 adiciona a coluna ADITIVA e NULLABLE `clients.origin`.
--   É segura para o rep-app (coluna nova nullable é ignorada pelas
--   queries/RLS existentes). Nenhuma tabela rep_*/orders/profiles e
--   nenhuma RLS existente é alterada. As demais tabelas (event_*,
--   tiny_contact_sync_jobs, event_dispatches) não são lidas pelo rep-app.
-- =====================================================================

-- 1) ENUMS (guardados) ------------------------------------------------
DO $$ BEGIN CREATE TYPE public.event_cashback_type AS ENUM ('PERCENT','FIXED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.event_cashback_eligibility AS ENUM ('ALL','NEW_ONLY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.event_gift_status AS ENUM ('PENDENTE','RETIRADO','CANCELADO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.event_credit_status AS ENUM ('ATIVO','USADO','EXPIRADO','CANCELADO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.tiny_sync_job_status AS ENUM ('PENDING','PROCESSING','DONE','FAILED','DEAD');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.event_dispatch_channel AS ENUM ('EMAIL','WHATSAPP');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.event_dispatch_status AS ENUM ('PENDENTE','ENVIADO','FALHOU','CANCELADO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) FUNÇÃO updated_at ------------------------------------------------
CREATE OR REPLACE FUNCTION public.event_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- 3) TABELAS ----------------------------------------------------------

-- 3.1 Edições de congresso
CREATE TABLE IF NOT EXISTS public.event_editions (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                      text NOT NULL UNIQUE,
  name                      text NOT NULL,
  location                  text,
  starts_at                 date,
  ends_at                   date,
  is_active                 boolean NOT NULL DEFAULT false,
  gift_name                 text,
  gift_stock                integer,                    -- null = ilimitado/desconhecido
  cashback_enabled          boolean NOT NULL DEFAULT false,
  cashback_type             public.event_cashback_type,
  cashback_value            numeric,
  cashback_min_order_value  numeric,
  cashback_min_order_qty    integer,
  cashback_eligibility      public.event_cashback_eligibility,
  cashback_valid_days       integer,
  created_by                uuid REFERENCES public.profiles(id),
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

-- 3.2 Pré-cadastros
CREATE TABLE IF NOT EXISTS public.event_registrations (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id         uuid NOT NULL REFERENCES public.event_editions(id) ON DELETE CASCADE,
  document           text,                               -- só dígitos
  name               text,
  email              text,
  phone              text,                               -- WhatsApp
  contact_type       public.sales_channel,               -- reusa enum existente
  qualified          boolean NOT NULL DEFAULT false,     -- Dentista/Distribuidora
  is_existing_client boolean NOT NULL DEFAULT false,
  matched_client_id  uuid REFERENCES public.clients(id),
  consent_version    text,
  consent_at         timestamptz,
  consent_ip_hmac    text,
  idempotency_key    text,
  utm_source         text,
  utm_medium         text,
  utm_campaign       text,
  utm_content        text,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_registrations_edition ON public.event_registrations(edition_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_document ON public.event_registrations(document);
CREATE UNIQUE INDEX IF NOT EXISTS uq_event_registrations_edition_document
  ON public.event_registrations(edition_id, document) WHERE document IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_event_registrations_idempotency
  ON public.event_registrations(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 3.3 Brindes / resgates
CREATE TABLE IF NOT EXISTS public.event_gift_redemptions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL UNIQUE REFERENCES public.event_registrations(id) ON DELETE CASCADE,
  edition_id      uuid NOT NULL REFERENCES public.event_editions(id) ON DELETE CASCADE,
  token           text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(32),'hex'),
  short_code      text NOT NULL,                         -- 6 dígitos, gerado pela app
  status          public.event_gift_status NOT NULL DEFAULT 'PENDENTE',
  redeemed_at     timestamptz,
  redeemed_by     uuid REFERENCES public.profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_event_gift_edition_shortcode
  ON public.event_gift_redemptions(edition_id, short_code);
CREATE INDEX IF NOT EXISTS idx_event_gift_edition_status
  ON public.event_gift_redemptions(edition_id, status);

-- 3.4 Créditos (cashback) — 1 por registration (registration é único por edition+document)
CREATE TABLE IF NOT EXISTS public.event_credits (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id   uuid NOT NULL UNIQUE REFERENCES public.event_registrations(id) ON DELETE CASCADE,
  edition_id        uuid NOT NULL REFERENCES public.event_editions(id) ON DELETE CASCADE,
  client_id         uuid REFERENCES public.clients(id),
  type              public.event_cashback_type NOT NULL,   -- snapshot
  value             numeric NOT NULL,                       -- snapshot
  min_order_value   numeric,                                -- snapshot
  min_order_qty     integer,                                -- snapshot
  valid_until       date,                                   -- snapshot
  status            public.event_credit_status NOT NULL DEFAULT 'ATIVO',
  redeemed_order_id uuid REFERENCES public.orders(id),
  redeemed_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_credits_client ON public.event_credits(client_id);

-- 3.5 Fila durável de sincronização de contato com o Tiny
CREATE TABLE IF NOT EXISTS public.tiny_contact_sync_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL UNIQUE REFERENCES public.event_registrations(id) ON DELETE CASCADE,
  status          public.tiny_sync_job_status NOT NULL DEFAULT 'PENDING',
  attempts        integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error      text,
  tiny_id         bigint,
  payload         jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tiny_sync_jobs_due
  ON public.tiny_contact_sync_jobs(next_attempt_at)
  WHERE status IN ('PENDING','FAILED');

-- 3.6 Confirmações (e-mail / WhatsApp)
CREATE TABLE IF NOT EXISTS public.event_dispatches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES public.event_registrations(id) ON DELETE CASCADE,
  channel         public.event_dispatch_channel NOT NULL DEFAULT 'EMAIL',
  status          public.event_dispatch_status NOT NULL DEFAULT 'PENDENTE',
  recipient       text,
  scheduled_for   timestamptz NOT NULL DEFAULT now(),
  sent_at         timestamptz,
  attempts        integer NOT NULL DEFAULT 0,
  send_error      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_dispatches_due
  ON public.event_dispatches(status, scheduled_for);

-- 4) TRIGGERS updated_at ---------------------------------------------
DROP TRIGGER IF EXISTS trg_event_editions_updated_at ON public.event_editions;
CREATE TRIGGER trg_event_editions_updated_at BEFORE UPDATE ON public.event_editions
  FOR EACH ROW EXECUTE FUNCTION public.event_touch_updated_at();

DROP TRIGGER IF EXISTS trg_tiny_sync_jobs_updated_at ON public.tiny_contact_sync_jobs;
CREATE TRIGGER trg_tiny_sync_jobs_updated_at BEFORE UPDATE ON public.tiny_contact_sync_jobs
  FOR EACH ROW EXECUTE FUNCTION public.event_touch_updated_at();

DROP TRIGGER IF EXISTS trg_event_dispatches_updated_at ON public.event_dispatches;
CREATE TRIGGER trg_event_dispatches_updated_at BEFORE UPDATE ON public.event_dispatches
  FOR EACH ROW EXECUTE FUNCTION public.event_touch_updated_at();

-- 5) RLS + POLICIES ---------------------------------------------------
-- manage = MASTER/GESTOR (FOR ALL); operate = +PRESTADOR (FOR SELECT).
-- Papel lido via get_user_role() (SECURITY DEFINER, já existente).

ALTER TABLE public.event_editions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_gift_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_credits          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tiny_contact_sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_dispatches       ENABLE ROW LEVEL SECURITY;

-- editions
DROP POLICY IF EXISTS event_editions_manage ON public.event_editions;
CREATE POLICY event_editions_manage ON public.event_editions FOR ALL
  USING      (get_user_role() = ANY (ARRAY['MASTER','GESTOR']::user_role[]))
  WITH CHECK (get_user_role() = ANY (ARRAY['MASTER','GESTOR']::user_role[]));
DROP POLICY IF EXISTS event_editions_operate_select ON public.event_editions;
CREATE POLICY event_editions_operate_select ON public.event_editions FOR SELECT
  USING (get_user_role() = ANY (ARRAY['MASTER','GESTOR','PRESTADOR']::user_role[]));

-- registrations
DROP POLICY IF EXISTS event_registrations_manage ON public.event_registrations;
CREATE POLICY event_registrations_manage ON public.event_registrations FOR ALL
  USING      (get_user_role() = ANY (ARRAY['MASTER','GESTOR']::user_role[]))
  WITH CHECK (get_user_role() = ANY (ARRAY['MASTER','GESTOR']::user_role[]));
DROP POLICY IF EXISTS event_registrations_operate_select ON public.event_registrations;
CREATE POLICY event_registrations_operate_select ON public.event_registrations FOR SELECT
  USING (get_user_role() = ANY (ARRAY['MASTER','GESTOR','PRESTADOR']::user_role[]));

-- gift redemptions
DROP POLICY IF EXISTS event_gift_redemptions_manage ON public.event_gift_redemptions;
CREATE POLICY event_gift_redemptions_manage ON public.event_gift_redemptions FOR ALL
  USING      (get_user_role() = ANY (ARRAY['MASTER','GESTOR']::user_role[]))
  WITH CHECK (get_user_role() = ANY (ARRAY['MASTER','GESTOR']::user_role[]));
DROP POLICY IF EXISTS event_gift_redemptions_operate_select ON public.event_gift_redemptions;
CREATE POLICY event_gift_redemptions_operate_select ON public.event_gift_redemptions FOR SELECT
  USING (get_user_role() = ANY (ARRAY['MASTER','GESTOR','PRESTADOR']::user_role[]));

-- credits (só MASTER/GESTOR)
DROP POLICY IF EXISTS event_credits_manage ON public.event_credits;
CREATE POLICY event_credits_manage ON public.event_credits FOR ALL
  USING      (get_user_role() = ANY (ARRAY['MASTER','GESTOR']::user_role[]))
  WITH CHECK (get_user_role() = ANY (ARRAY['MASTER','GESTOR']::user_role[]));

-- sync jobs (só MASTER/GESTOR; escrita real por service_role via bypass de RLS)
DROP POLICY IF EXISTS tiny_contact_sync_jobs_manage ON public.tiny_contact_sync_jobs;
CREATE POLICY tiny_contact_sync_jobs_manage ON public.tiny_contact_sync_jobs FOR ALL
  USING      (get_user_role() = ANY (ARRAY['MASTER','GESTOR']::user_role[]))
  WITH CHECK (get_user_role() = ANY (ARRAY['MASTER','GESTOR']::user_role[]));

-- dispatches (só MASTER/GESTOR)
DROP POLICY IF EXISTS event_dispatches_manage ON public.event_dispatches;
CREATE POLICY event_dispatches_manage ON public.event_dispatches FOR ALL
  USING      (get_user_role() = ANY (ARRAY['MASTER','GESTOR']::user_role[]))
  WITH CHECK (get_user_role() = ANY (ARRAY['MASTER','GESTOR']::user_role[]));

-- 6) GRANTS -----------------------------------------------------------
GRANT ALL ON
  public.event_editions, public.event_registrations, public.event_gift_redemptions,
  public.event_credits, public.tiny_contact_sync_jobs, public.event_dispatches
  TO service_role;

-- RLS continua sendo o gate real; anon NÃO recebe grant.
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.event_editions, public.event_registrations, public.event_gift_redemptions,
  public.event_credits, public.tiny_contact_sync_jobs, public.event_dispatches
  TO authenticated;

-- 7) RPCs -------------------------------------------------------------

-- 7.1 Validação pública do brinde — revela PII só quando acionável (PENDENTE)
CREATE OR REPLACE FUNCTION public.validate_gift_token(p_token text)
RETURNS TABLE(is_valid boolean, already_redeemed boolean, is_canceled boolean,
              edition_name text, gift_name text, short_code text, participant_first_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  SELECT g.status AS status, g.short_code AS short_code,
         e.name AS edition_name, e.gift_name AS gift_name,
         split_part(coalesce(reg.name,''),' ',1) AS first_name
    INTO r
    FROM event_gift_redemptions g
    JOIN event_editions e        ON e.id  = g.edition_id
    JOIN event_registrations reg ON reg.id = g.registration_id
   WHERE g.token = p_token;
  IF NOT FOUND THEN RETURN; END IF;
  RETURN QUERY SELECT
    (r.status = 'PENDENTE'),
    (r.status = 'RETIRADO'),
    (r.status = 'CANCELADO'),
    CASE WHEN r.status='PENDENTE' THEN r.edition_name END,
    CASE WHEN r.status='PENDENTE' THEN r.gift_name END,
    CASE WHEN r.status='PENDENTE' THEN r.short_code END,
    CASE WHEN r.status='PENDENTE' THEN r.first_name END;
END $$;
GRANT EXECUTE ON FUNCTION public.validate_gift_token(text) TO anon, authenticated;

-- 7.2 Retirada atômica (anti-duplicidade) — interno (operate: MASTER/GESTOR/PRESTADOR)
CREATE OR REPLACE FUNCTION public.redeem_gift(p_token text)
RETURNS TABLE(success boolean, outcome text, redeemed_at timestamptz, redeemed_by_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role user_role;
  v_id uuid; v_status public.event_gift_status;
  v_at timestamptz; v_by uuid;
BEGIN
  v_role := get_user_role();
  IF v_role IS NULL OR v_role <> ALL (ARRAY['MASTER','GESTOR','PRESTADOR']::user_role[]) THEN
    RETURN QUERY SELECT false, 'SEM_PERMISSAO'::text, NULL::timestamptz, NULL::text; RETURN;
  END IF;

  UPDATE event_gift_redemptions
     SET status='RETIRADO', redeemed_at=now(), redeemed_by=auth.uid()
   WHERE token=p_token AND status='PENDENTE'
   RETURNING event_gift_redemptions.id, event_gift_redemptions.redeemed_at INTO v_id, v_at;

  IF FOUND THEN
    RETURN QUERY SELECT true, 'RETIRADO'::text, v_at,
      (SELECT full_name FROM profiles WHERE id = auth.uid());
    RETURN;
  END IF;

  SELECT g.id, g.status, g.redeemed_at, g.redeemed_by
    INTO v_id, v_status, v_at, v_by
    FROM event_gift_redemptions g WHERE g.token = p_token;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'NAO_ENCONTRADO'::text, NULL::timestamptz, NULL::text; RETURN;
  ELSIF v_status='RETIRADO' THEN
    RETURN QUERY SELECT false, 'JA_RETIRADO'::text, v_at,
      (SELECT full_name FROM profiles WHERE id = v_by); RETURN;
  ELSIF v_status='CANCELADO' THEN
    RETURN QUERY SELECT false, 'CANCELADO'::text, NULL::timestamptz, NULL::text; RETURN;
  END IF;

  RETURN QUERY SELECT false, 'NAO_ENCONTRADO'::text, NULL::timestamptz, NULL::text;
END $$;
-- Supabase concede EXECUTE a anon diretamente (default privileges), não só via PUBLIC.
REVOKE EXECUTE ON FUNCTION public.redeem_gift(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_gift(text) TO authenticated;

-- find_client_by_document(text): REUSADO (já existe) — não recriar.

-- 8) MARCADOR DE ORIGEM EM clients (ADITIVO / NULLABLE) ---------------
-- ⚠️ Tabela compartilhada com o adds-rep-app. Coluna nova nullable é
--    segura (rep-app ignora). Usada pela promoção seletiva do Épico 3.
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS origin text;
COMMENT ON COLUMN public.clients.origin IS
  'Origem do cadastro (ex.: congresso:<slug>). Usado pela promoção seletiva do módulo Congressos.';
