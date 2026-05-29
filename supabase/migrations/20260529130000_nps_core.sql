-- =============================================================================
-- NPS (Net Promoter Score) — núcleo de dados, RLS e automação (Fase 1)
-- Tudo isolado sob o prefixo nps_*. Idempotente (seguro re-rodar).
--
-- IMPACTO MULTI-APP (adds-rep-app):
--   • As tabelas nps_* têm RLS restrita a MASTER/GESTOR. O rep-app NÃO as
--     consome nesta fase (anon e demais roles ficam sem acesso direto).
--   • A ÚNICA mudança transversal é um trigger AFTER UPDATE OF status em
--     `orders` (trg_orders_nps_enqueue → nps_enqueue_on_status). Ele só
--     enfileira uma pesquisa quando EXISTE uma campanha TRANSACIONAL ATIVA
--     para o canal do cliente. Sem campanha ativa, o trigger é INERTE —
--     nenhum comportamento muda em nenhum dos dois apps. A campanha seed
--     nasce is_active = false (dormente) e só vai ao ar quando o admin
--     ativar pela tela de Configurações de NPS.
--   • O trigger NÃO faz chamadas externas (apenas INSERT local); o envio
--     real (e-mail / WhatsApp NI) é feito depois pelo cron /api/cron/nps-dispatch.
--   • SEGURANÇA CROSS-APP: nps_enqueue_on_status tem EXCEPTION WHEN OTHERS →
--     RETURN NEW. NPS é satélite e JAMAIS pode abortar um UPDATE de pedido
--     (que vem dos dois apps). Falhas viram RAISE WARNING (log), nunca rollback.
--   • CLOSED-LOOP: ao gravar uma resposta DETRATOR, o trigger
--     trg_nps_response_followup abre automaticamente uma tratativa em
--     nps_followups (pool central MASTER/GESTOR). A submissão pública passa
--     pelo RPC atômico submit_nps_response (valida token + grava + marca
--     RESPONDIDO numa só transação).
-- =============================================================================

-- 1) ENUMS --------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'nps_survey_type') THEN
    CREATE TYPE public.nps_survey_type AS ENUM ('TRANSACIONAL', 'RELACIONAL');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'nps_dispatch_channel') THEN
    CREATE TYPE public.nps_dispatch_channel AS ENUM ('EMAIL', 'WHATSAPP');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'nps_dispatch_status') THEN
    CREATE TYPE public.nps_dispatch_status AS ENUM
      ('PENDENTE', 'ENVIADO', 'RESPONDIDO', 'EXPIRADO', 'FALHOU', 'CANCELADO');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'nps_category') THEN
    CREATE TYPE public.nps_category AS ENUM ('DETRATOR', 'PASSIVO', 'PROMOTOR');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'nps_followup_status') THEN
    CREATE TYPE public.nps_followup_status AS ENUM
      ('ABERTO', 'EM_TRATATIVA', 'RESOLVIDO', 'DISPENSADO');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'nps_theme') THEN
    CREATE TYPE public.nps_theme AS ENUM (
      'ATENDIMENTO', 'PRAZO_ENTREGA', 'QUALIDADE_ARTE', 'QUALIDADE_PRODUTO',
      'PRECO', 'COMUNICACAO', 'FACILIDADE_COMPRA', 'POS_VENDA', 'OUTRO'
    );
  END IF;
END $$;

-- 2) TABELAS ------------------------------------------------------------------

-- 2.1) Campanha / definição da pesquisa (channel-agnostic de nascença)
CREATE TABLE IF NOT EXISTS public.nps_surveys (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 text NOT NULL,
  type                 public.nps_survey_type NOT NULL,
  sales_channel        public.sales_channel,            -- NULL = todos os canais
  trigger_status       public.order_status,             -- obrigatório p/ TRANSACIONAL
  delay_hours          integer NOT NULL DEFAULT 48  CHECK (delay_hours >= 0),
  expires_after_days   integer NOT NULL DEFAULT 30  CHECK (expires_after_days > 0),
  cooldown_days        integer NOT NULL DEFAULT 90  CHECK (cooldown_days >= 0),
  max_reminders        integer NOT NULL DEFAULT 1   CHECK (max_reminders >= 0),
  reminder_after_hours integer NOT NULL DEFAULT 72  CHECK (reminder_after_hours > 0),
  primary_channel      public.nps_dispatch_channel NOT NULL DEFAULT 'EMAIL',
  fallback_channel     public.nps_dispatch_channel,
  question_main        text NOT NULL DEFAULT 'Em uma escala de 0 a 10, o quanto você recomendaria a ADDS Brasil a um amigo ou colega?',
  question_detractor   text NOT NULL DEFAULT 'O que faltou para essa experiência ser melhor? Seu retorno é muito importante para nós.',
  question_passive     text NOT NULL DEFAULT 'O que poderíamos ter feito para essa experiência virar um 10?',
  question_promoter    text NOT NULL DEFAULT 'Que ótimo! O que você mais gostou na sua experiência com a ADDS?',
  is_active            boolean NOT NULL DEFAULT false,  -- dormente por padrão: ativação explícita pelo admin
  created_by           uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nps_surveys_trigger_chk CHECK (
       (type = 'TRANSACIONAL' AND trigger_status IS NOT NULL)
    OR (type = 'RELACIONAL'   AND trigger_status IS NULL)
  )
);

-- no máximo UMA campanha transacional ativa por canal
-- NULLS NOT DISTINCT (PG15+) garante no máx. UMA campanha "todos os canais"
-- (sales_channel = NULL) ativa, além de uma por canal específico.
CREATE UNIQUE INDEX IF NOT EXISTS nps_surveys_active_transactional_uniq
  ON public.nps_surveys (type, sales_channel) NULLS NOT DISTINCT
  WHERE is_active AND type = 'TRANSACIONAL';

-- 2.2) Disparo individual (1 por evento; carrega controle de cooldown/anti-fadiga)
CREATE TABLE IF NOT EXISTS public.nps_dispatches (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id        uuid NOT NULL REFERENCES public.nps_surveys(id) ON DELETE CASCADE,
  client_id        uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  order_id         uuid REFERENCES public.orders(id)  ON DELETE SET NULL,
  token            text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  channel          public.nps_dispatch_channel NOT NULL DEFAULT 'EMAIL',
  status           public.nps_dispatch_status  NOT NULL DEFAULT 'PENDENTE',
  recipient_email  text,
  recipient_phone  text,
  scheduled_for    timestamptz NOT NULL DEFAULT now(),
  sent_at          timestamptz,
  expires_at       timestamptz,
  reminders_sent   integer NOT NULL DEFAULT 0,
  last_reminder_at timestamptz,
  send_error       text,
  created_by       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS nps_dispatches_order_uniq
  ON public.nps_dispatches (order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS nps_dispatches_due_idx
  ON public.nps_dispatches (status, scheduled_for);
CREATE INDEX IF NOT EXISTS nps_dispatches_client_idx
  ON public.nps_dispatches (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS nps_dispatches_survey_idx
  ON public.nps_dispatches (survey_id);

-- 2.3) Resposta (imutável; campos denormalizados p/ analytics sem joins pesados)
CREATE TABLE IF NOT EXISTS public.nps_responses (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id       uuid NOT NULL UNIQUE REFERENCES public.nps_dispatches(id) ON DELETE CASCADE,
  survey_id         uuid NOT NULL REFERENCES public.nps_surveys(id) ON DELETE CASCADE,
  client_id         uuid REFERENCES public.clients(id)  ON DELETE SET NULL,
  order_id          uuid REFERENCES public.orders(id)   ON DELETE SET NULL,
  sales_channel     public.sales_channel,
  rep_id            uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  score             smallint NOT NULL CHECK (score BETWEEN 0 AND 10),
  category          public.nps_category GENERATED ALWAYS AS (
                      CASE WHEN score <= 6 THEN 'DETRATOR'::public.nps_category
                           WHEN score <= 8 THEN 'PASSIVO'::public.nps_category
                           ELSE 'PROMOTOR'::public.nps_category END
                    ) STORED,
  comment           text,
  allow_contact     boolean NOT NULL DEFAULT true,   -- LGPD: consentimento p/ follow-up
  allow_testimonial boolean NOT NULL DEFAULT false,  -- consentimento p/ usar como depoimento
  responded_at      timestamptz NOT NULL DEFAULT now(),
  respondent_meta   jsonb,                           -- ip hash / user agent (auditoria)
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS nps_responses_cat_idx     ON public.nps_responses (category, responded_at DESC);
CREATE INDEX IF NOT EXISTS nps_responses_channel_idx ON public.nps_responses (sales_channel);
CREATE INDEX IF NOT EXISTS nps_responses_rep_idx     ON public.nps_responses (rep_id);
CREATE INDEX IF NOT EXISTS nps_responses_survey_idx  ON public.nps_responses (survey_id, responded_at DESC);

-- 2.4) Tags de tema (análise de causa-raiz)
CREATE TABLE IF NOT EXISTS public.nps_response_tags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid NOT NULL REFERENCES public.nps_responses(id) ON DELETE CASCADE,
  theme       public.nps_theme NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (response_id, theme)
);
CREATE INDEX IF NOT EXISTS nps_response_tags_theme_idx ON public.nps_response_tags (theme);

-- 2.5) Tratativa (closed-loop) — pool central tratado por MASTER/GESTOR
CREATE TABLE IF NOT EXISTS public.nps_followups (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id     uuid NOT NULL UNIQUE REFERENCES public.nps_responses(id) ON DELETE CASCADE,
  status          public.nps_followup_status NOT NULL DEFAULT 'ABERTO',
  assigned_to     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolution_note text,
  resolved_at     timestamptz,
  resolved_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS nps_followups_status_idx   ON public.nps_followups (status, created_at DESC);
CREATE INDEX IF NOT EXISTS nps_followups_assigned_idx ON public.nps_followups (assigned_to);

-- 3) TRIGGERS DE updated_at (reutiliza public.update_updated_at) ---------------
DROP TRIGGER IF EXISTS trg_nps_surveys_updated ON public.nps_surveys;
CREATE TRIGGER trg_nps_surveys_updated BEFORE UPDATE ON public.nps_surveys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_nps_dispatches_updated ON public.nps_dispatches;
CREATE TRIGGER trg_nps_dispatches_updated BEFORE UPDATE ON public.nps_dispatches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_nps_followups_updated ON public.nps_followups;
CREATE TRIGGER trg_nps_followups_updated BEFORE UPDATE ON public.nps_followups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 4) RLS — staff interno (MASTER/GESTOR). service_role faz bypass; anon sem acesso
ALTER TABLE public.nps_surveys       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nps_dispatches    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nps_responses     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nps_response_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nps_followups     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nps_surveys_staff ON public.nps_surveys;
CREATE POLICY nps_surveys_staff ON public.nps_surveys FOR ALL
  USING      (public.get_user_role() = ANY (ARRAY['MASTER','GESTOR']::user_role[]))
  WITH CHECK (public.get_user_role() = ANY (ARRAY['MASTER','GESTOR']::user_role[]));

DROP POLICY IF EXISTS nps_dispatches_staff ON public.nps_dispatches;
CREATE POLICY nps_dispatches_staff ON public.nps_dispatches FOR ALL
  USING      (public.get_user_role() = ANY (ARRAY['MASTER','GESTOR']::user_role[]))
  WITH CHECK (public.get_user_role() = ANY (ARRAY['MASTER','GESTOR']::user_role[]));

DROP POLICY IF EXISTS nps_responses_staff ON public.nps_responses;
CREATE POLICY nps_responses_staff ON public.nps_responses FOR ALL
  USING      (public.get_user_role() = ANY (ARRAY['MASTER','GESTOR']::user_role[]))
  WITH CHECK (public.get_user_role() = ANY (ARRAY['MASTER','GESTOR']::user_role[]));

DROP POLICY IF EXISTS nps_response_tags_staff ON public.nps_response_tags;
CREATE POLICY nps_response_tags_staff ON public.nps_response_tags FOR ALL
  USING      (public.get_user_role() = ANY (ARRAY['MASTER','GESTOR']::user_role[]))
  WITH CHECK (public.get_user_role() = ANY (ARRAY['MASTER','GESTOR']::user_role[]));

DROP POLICY IF EXISTS nps_followups_staff ON public.nps_followups;
CREATE POLICY nps_followups_staff ON public.nps_followups FOR ALL
  USING      (public.get_user_role() = ANY (ARRAY['MASTER','GESTOR']::user_role[]))
  WITH CHECK (public.get_user_role() = ANY (ARRAY['MASTER','GESTOR']::user_role[]));

-- 5) GRANTS explícitos (anon NÃO recebe acesso direto; só o RPC abaixo)
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.nps_surveys, public.nps_dispatches, public.nps_responses,
  public.nps_response_tags, public.nps_followups
  TO authenticated;
GRANT ALL ON
  public.nps_surveys, public.nps_dispatches, public.nps_responses,
  public.nps_response_tags, public.nps_followups
  TO service_role;

-- 6) RPC público de validação de token (espelha validate_approval_token) ------
CREATE OR REPLACE FUNCTION public.validate_nps_token(p_token text)
RETURNS TABLE (
  is_valid           boolean,
  already_responded  boolean,
  is_expired         boolean,
  dispatch_id        uuid,
  survey_id          uuid,
  survey_type        public.nps_survey_type,
  client_name        text,
  order_title        text,
  question_main      text,
  question_detractor text,
  question_passive   text,
  question_promoter  text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d          public.nps_dispatches%ROWTYPE;
  s          public.nps_surveys%ROWTYPE;
  v_answered boolean;
  v_expired  boolean;
  v_valid    boolean;
BEGIN
  SELECT * INTO d FROM public.nps_dispatches WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN;  -- token inexistente → 0 linhas
  END IF;

  SELECT * INTO s FROM public.nps_surveys WHERE id = d.survey_id;

  v_answered := (d.status = 'RESPONDIDO'
                 OR EXISTS (SELECT 1 FROM public.nps_responses r WHERE r.dispatch_id = d.id));
  v_expired  := (d.expires_at IS NOT NULL AND d.expires_at <= now());
  v_valid    := (d.status NOT IN ('RESPONDIDO','CANCELADO') AND NOT v_expired AND NOT v_answered);

  RETURN QUERY
  SELECT
    v_valid,
    v_answered,
    v_expired,
    d.id,
    s.id,
    s.type,
    -- só devolve PII quando o token ainda é acionável (defesa em profundidade / LGPD)
    CASE WHEN v_valid
         THEN (SELECT split_part(c.name, ' ', 1) FROM public.clients c WHERE c.id = d.client_id)
         END AS client_name,
    CASE WHEN v_valid
         THEN (SELECT o.title FROM public.orders o WHERE o.id = d.order_id)
         END AS order_title,
    s.question_main,
    s.question_detractor,
    s.question_passive,
    s.question_promoter;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_nps_token(text) TO anon, authenticated;

-- 7) Trigger de enfileiramento automático na transição de status do pedido ----
--    Apenas INSERT local (sem chamadas externas). O envio é do cron.
CREATE OR REPLACE FUNCTION public.nps_enqueue_on_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_survey    public.nps_surveys%ROWTYPE;
  v_channel   public.sales_channel;
  v_email     text;
  v_phone     text;
  v_chan      public.nps_dispatch_channel;
  v_scheduled timestamptz;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.client_id IS NOT NULL THEN

    -- contato já normalizado (NULL quando vazio/só espaços)
    SELECT c.sales_channel, NULLIF(trim(c.email), ''), NULLIF(trim(c.phone), '')
      INTO v_channel, v_email, v_phone
    FROM public.clients c
    WHERE c.id = NEW.client_id;

    -- campanha transacional ativa p/ este status (prefere a específica do canal)
    SELECT s.* INTO v_survey
    FROM public.nps_surveys s
    WHERE s.is_active
      AND s.type = 'TRANSACIONAL'
      AND s.trigger_status = NEW.status
      AND (s.sales_channel IS NULL OR s.sales_channel = v_channel)
    ORDER BY (s.sales_channel IS NOT NULL) DESC
    LIMIT 1;

    IF NOT FOUND THEN
      RETURN NEW;  -- nenhuma campanha ativa → trigger inerte
    END IF;

    -- escolhe canal: usa o primário se tiver contato; só cai no fallback se ele
    -- estiver configurado E tiver contato; senão NÃO enfileira (sem órfão)
    v_chan := v_survey.primary_channel;
    IF v_chan = 'EMAIL' AND v_email IS NULL THEN
      IF v_survey.fallback_channel = 'WHATSAPP' AND v_phone IS NOT NULL THEN
        v_chan := 'WHATSAPP';
      ELSE
        RETURN NEW;  -- sem canal utilizável
      END IF;
    ELSIF v_chan = 'WHATSAPP' AND v_phone IS NULL THEN
      IF v_survey.fallback_channel = 'EMAIL' AND v_email IS NOT NULL THEN
        v_chan := 'EMAIL';
      ELSE
        RETURN NEW;  -- sem canal utilizável
      END IF;
    END IF;

    -- cooldown anti-fadiga por cliente
    IF v_survey.cooldown_days > 0 AND EXISTS (
      SELECT 1 FROM public.nps_dispatches d
      WHERE d.client_id = NEW.client_id
        AND d.created_at > now() - make_interval(days => v_survey.cooldown_days)
    ) THEN
      RETURN NEW;
    END IF;

    v_scheduled := now() + make_interval(hours => v_survey.delay_hours);

    -- 1 disparo por pedido: ON CONFLICT cobre corrida concorrente sem abortar o UPDATE
    INSERT INTO public.nps_dispatches
      (survey_id, client_id, order_id, channel, status,
       recipient_email, recipient_phone, scheduled_for, expires_at)
    VALUES
      (v_survey.id, NEW.client_id, NEW.id, v_chan, 'PENDENTE',
       v_email, v_phone, v_scheduled,
       v_scheduled + make_interval(days => v_survey.expires_after_days))
    ON CONFLICT (order_id) WHERE order_id IS NOT NULL DO NOTHING;
  END IF;

  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    -- NPS é satélite: jamais abortar o UPDATE do pedido (tabela cross-app).
    RAISE WARNING 'nps_enqueue_on_status falhou para order %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_nps_enqueue ON public.orders;
CREATE TRIGGER trg_orders_nps_enqueue
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.nps_enqueue_on_status();

-- 8) CLOSED-LOOP — abre tratativa automaticamente p/ resposta DETRATOR ---------
--    Garante no banco que NENHUM detrator escapa do pool central (MASTER/GESTOR).
CREATE OR REPLACE FUNCTION public.nps_open_followup_for_detractor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.category = 'DETRATOR' THEN
    INSERT INTO public.nps_followups (response_id)
    VALUES (NEW.id)
    ON CONFLICT (response_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nps_response_followup ON public.nps_responses;
CREATE TRIGGER trg_nps_response_followup
  AFTER INSERT ON public.nps_responses
  FOR EACH ROW EXECUTE FUNCTION public.nps_open_followup_for_detractor();

-- 9) RPC de submissão atômica da resposta pública --------------------------------
--    Valida o token + grava resposta + tags + marca o disparo como RESPONDIDO
--    numa única transação (FOR UPDATE evita corrida / dupla resposta).
--    Chamado pela rota /api/nps/respond (service_role); NÃO exposto a anon.
CREATE OR REPLACE FUNCTION public.submit_nps_response(
  p_token             text,
  p_score             integer,
  p_comment           text               DEFAULT NULL,
  p_allow_contact     boolean            DEFAULT true,
  p_allow_testimonial boolean            DEFAULT false,
  p_themes            public.nps_theme[] DEFAULT NULL,
  p_meta              jsonb              DEFAULT NULL
)
RETURNS TABLE (ok boolean, category public.nps_category, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d          public.nps_dispatches%ROWTYPE;
  v_resp_id  uuid;
  v_category public.nps_category;
  v_channel  public.sales_channel;
  v_rep_id   uuid;
  t          public.nps_theme;
BEGIN
  IF p_score IS NULL OR p_score < 0 OR p_score > 10 THEN
    RETURN QUERY SELECT false, NULL::public.nps_category, 'Nota inválida (use 0 a 10).';
    RETURN;
  END IF;

  SELECT * INTO d FROM public.nps_dispatches WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::public.nps_category, 'Pesquisa não encontrada.';
    RETURN;
  END IF;

  IF d.status = 'CANCELADO' THEN
    RETURN QUERY SELECT false, NULL::public.nps_category, 'Pesquisa cancelada.';
    RETURN;
  END IF;
  IF d.status = 'RESPONDIDO'
     OR EXISTS (SELECT 1 FROM public.nps_responses r WHERE r.dispatch_id = d.id) THEN
    RETURN QUERY SELECT false, NULL::public.nps_category, 'Esta pesquisa já foi respondida.';
    RETURN;
  END IF;
  IF d.expires_at IS NOT NULL AND d.expires_at <= now() THEN
    RETURN QUERY SELECT false, NULL::public.nps_category, 'O prazo para responder expirou.';
    RETURN;
  END IF;

  -- denormaliza canal/representante do pedido (fallback no cliente)
  SELECT o.sales_channel, o.rep_id INTO v_channel, v_rep_id
  FROM public.orders o WHERE o.id = d.order_id;
  IF v_channel IS NULL THEN
    SELECT c.sales_channel INTO v_channel FROM public.clients c WHERE c.id = d.client_id;
  END IF;

  INSERT INTO public.nps_responses
    (dispatch_id, survey_id, client_id, order_id, sales_channel, rep_id,
     score, comment, allow_contact, allow_testimonial, respondent_meta)
  VALUES
    (d.id, d.survey_id, d.client_id, d.order_id, v_channel, v_rep_id,
     p_score::smallint, NULLIF(trim(p_comment), ''),
     COALESCE(p_allow_contact, true), COALESCE(p_allow_testimonial, false), p_meta)
  RETURNING id INTO v_resp_id;

  -- coluna qualificada p/ evitar colisão com o parâmetro OUT "category"
  SELECT r.category INTO v_category FROM public.nps_responses r WHERE r.id = v_resp_id;

  IF p_themes IS NOT NULL THEN
    FOREACH t IN ARRAY p_themes LOOP
      INSERT INTO public.nps_response_tags (response_id, theme)
      VALUES (v_resp_id, t)
      ON CONFLICT (response_id, theme) DO NOTHING;
    END LOOP;
  END IF;

  UPDATE public.nps_dispatches SET status = 'RESPONDIDO' WHERE id = d.id;

  -- tratativa do detrator é aberta pelo trigger trg_nps_response_followup
  RETURN QUERY SELECT true, v_category, 'Obrigado pelo seu retorno!';
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_nps_response(
  text, integer, text, boolean, boolean, public.nps_theme[], jsonb
) TO service_role;

-- 10) SEED — campanha-modelo p/ Dentistas, DORMENTE (is_active = false) ---------
INSERT INTO public.nps_surveys
  (name, type, sales_channel, trigger_status, primary_channel, fallback_channel, is_active)
SELECT
  'NPS Transacional — Dentistas (pós-entrega)', 'TRANSACIONAL', 'DENTISTA',
  'ENTREGUE', 'EMAIL', NULL, false
WHERE NOT EXISTS (
  SELECT 1 FROM public.nps_surveys
  WHERE type = 'TRANSACIONAL' AND sales_channel = 'DENTISTA'
);

-- 11) HARDENING de execução (advisors pós-DDL) ---------------------------------
--   • Funções de TRIGGER nunca devem ser chamáveis via REST/RPC.
--   • submit_nps_response NÃO é exposto a anon (entra só pela rota service_role).
--   • validate_nps_token permanece anon (superfície pública de leitura, read-only).
REVOKE ALL ON FUNCTION public.nps_enqueue_on_status()            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.nps_open_followup_for_detractor()  FROM PUBLIC, anon, authenticated;
-- submit_nps_response: SÓ service_role (a rota /api/nps/respond usa admin client).
-- authenticated também é revogado p/ ninguém logado chamar a RPC via PostgREST
-- pulando o rate-limit/validação da rota.
REVOKE ALL ON FUNCTION public.submit_nps_response(
  text, integer, text, boolean, boolean, public.nps_theme[], jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_nps_response(
  text, integer, text, boolean, boolean, public.nps_theme[], jsonb
) TO service_role;
GRANT EXECUTE ON FUNCTION public.validate_nps_token(text) TO anon, authenticated;

-- índices de FK de alto valor (detalhe do pedido / histórico do cliente)
CREATE INDEX IF NOT EXISTS nps_responses_order_idx  ON public.nps_responses (order_id);
CREATE INDEX IF NOT EXISTS nps_responses_client_idx ON public.nps_responses (client_id);
