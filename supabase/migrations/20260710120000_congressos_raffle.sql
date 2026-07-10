-- =====================================================================
-- Congressos — Sorteio (Épico 8)
-- Número da sorte por inscrição + config por edição + histórico de ganhadores.
--
-- APLICAÇÃO: manual, via Supabase Dashboard → SQL Editor, APÓS o merge do PR.
-- (Migrations NÃO são aplicadas automaticamente no deploy.)
-- SEM BEGIN/COMMIT (o SQL Editor não suporta transação explícita).
-- Idempotente: guard de enum, ADD COLUMN / CREATE TABLE / CREATE INDEX IF NOT
-- EXISTS, DROP POLICY IF EXISTS antes de CREATE POLICY, CREATE OR REPLACE FUNCTION.
--
-- IMPACTO MULTI-APP (banco compartilhado com adds-rep-app):
--   SEGURO. Só toca tabelas event_* (não lidas pelo rep-app): colunas ADITIVAS em
--   event_editions/event_registrations e a nova event_raffle_draws. Nenhuma tabela
--   rep_*/clients/orders/profiles nem RLS existente é alterada. REPRESENTANTE não
--   recebe acesso ao sorteio.
-- =====================================================================

-- 1) ENUM -------------------------------------------------------------
DO $$ BEGIN CREATE TYPE public.event_raffle_eligibility AS ENUM ('ALL','QUALIFIED','GIFT_REDEEMED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) CONFIG na edição -------------------------------------------------
ALTER TABLE public.event_editions
  ADD COLUMN IF NOT EXISTS raffle_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS raffle_eligibility public.event_raffle_eligibility NOT NULL DEFAULT 'ALL',
  ADD COLUMN IF NOT EXISTS raffle_allow_repeat_winners boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS raffle_prize text,
  ADD COLUMN IF NOT EXISTS raffle_counter integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.event_editions.raffle_enabled IS 'Sorteio (Épico 8) ligado para esta edição.';
COMMENT ON COLUMN public.event_editions.raffle_eligibility IS 'Quem concorre: ALL | QUALIFIED (Dentista/Distribuidora) | GIFT_REDEEMED (retirou o brinde).';
COMMENT ON COLUMN public.event_editions.raffle_allow_repeat_winners IS 'Se false, um ganhador anterior é excluído dos próximos sorteios.';
COMMENT ON COLUMN public.event_editions.raffle_counter IS 'Contador interno do número da sorte sequencial (não editar à mão).';

-- 3) NÚMERO da sorte na inscrição ------------------------------------
ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS raffle_number integer;

CREATE UNIQUE INDEX IF NOT EXISTS uq_event_registrations_edition_raffle
  ON public.event_registrations(edition_id, raffle_number)
  WHERE raffle_number IS NOT NULL;

COMMENT ON COLUMN public.event_registrations.raffle_number IS 'Número da sorte sequencial por edição (Épico 8). Null quando a edição não tem sorteio.';

-- 4) HISTÓRICO de ganhadores (auditável) -----------------------------
CREATE TABLE IF NOT EXISTS public.event_raffle_draws (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id        uuid NOT NULL REFERENCES public.event_editions(id) ON DELETE CASCADE,
  registration_id   uuid NOT NULL REFERENCES public.event_registrations(id) ON DELETE CASCADE,
  raffle_number     integer,
  prize             text,
  pool_size         integer,
  drawn_for_date    date,            -- null = pool acumulado; data = "sorteio do dia"
  drawn_at          timestamptz NOT NULL DEFAULT now(),
  drawn_by          uuid REFERENCES public.profiles(id)
);
CREATE INDEX IF NOT EXISTS idx_event_raffle_draws_edition ON public.event_raffle_draws(edition_id);

ALTER TABLE public.event_raffle_draws ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_raffle_draws_manage ON public.event_raffle_draws;
CREATE POLICY event_raffle_draws_manage ON public.event_raffle_draws FOR ALL
  USING      (get_user_role() = ANY (ARRAY['MASTER','GESTOR']::user_role[]))
  WITH CHECK (get_user_role() = ANY (ARRAY['MASTER','GESTOR']::user_role[]));

DROP POLICY IF EXISTS event_raffle_draws_operate_select ON public.event_raffle_draws;
CREATE POLICY event_raffle_draws_operate_select ON public.event_raffle_draws FOR SELECT
  USING (get_user_role() = ANY (ARRAY['MASTER','GESTOR','PRESTADOR']::user_role[]));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_raffle_draws TO authenticated;
GRANT ALL ON public.event_raffle_draws TO service_role;

-- 5) RPC: atribui o número da sorte (sequencial por edição, atômico) --
--    Idempotente: se a inscrição já tem número, retorna o mesmo. O incremento
--    UPDATE ... RETURNING trava a linha da edição, serializando cadastros
--    concorrentes (sem números duplicados). Gaps são aceitáveis.
CREATE OR REPLACE FUNCTION public.assign_raffle_number(p_registration_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_edition uuid;
  v_num integer;
  v_enabled boolean;
BEGIN
  SELECT r.edition_id, r.raffle_number INTO v_edition, v_num
    FROM event_registrations r WHERE r.id = p_registration_id;
  IF v_edition IS NULL THEN RETURN NULL; END IF;
  IF v_num IS NOT NULL THEN RETURN v_num; END IF;

  SELECT raffle_enabled INTO v_enabled FROM event_editions WHERE id = v_edition;
  IF NOT COALESCE(v_enabled, false) THEN RETURN NULL; END IF;

  UPDATE event_editions SET raffle_counter = raffle_counter + 1
    WHERE id = v_edition RETURNING raffle_counter INTO v_num;
  UPDATE event_registrations SET raffle_number = v_num WHERE id = p_registration_id;
  RETURN v_num;
END $$;
REVOKE EXECUTE ON FUNCTION public.assign_raffle_number(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_raffle_number(uuid) TO authenticated, service_role;

-- 6) RPC: sorteia UM ganhador (aleatório, registra o sorteio) --------
--    Interno (operate: MASTER/GESTOR/PRESTADOR). p_for_date != null → sorteia só
--    entre os inscritos daquele dia (America/Sao_Paulo). Exclui ganhadores
--    anteriores quando a edição não permite repetir.
CREATE OR REPLACE FUNCTION public.raffle_draw(p_edition_id uuid, p_for_date date DEFAULT NULL)
RETURNS TABLE(success boolean, outcome text, registration_id uuid, participant_name text, raffle_number integer, pool_size integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role user_role;
  v_enabled boolean;
  v_elig public.event_raffle_eligibility;
  v_repeat boolean;
  v_prize text;
  v_win uuid; v_name text; v_num integer; v_pool integer;
BEGIN
  v_role := get_user_role();
  IF v_role IS NULL OR v_role <> ALL (ARRAY['MASTER','GESTOR','PRESTADOR']::user_role[]) THEN
    RETURN QUERY SELECT false, 'SEM_PERMISSAO'::text, NULL::uuid, NULL::text, NULL::integer, NULL::integer;
    RETURN;
  END IF;

  SELECT raffle_enabled, raffle_eligibility, raffle_allow_repeat_winners, raffle_prize
    INTO v_enabled, v_elig, v_repeat, v_prize
    FROM event_editions WHERE id = p_edition_id;

  IF NOT COALESCE(v_enabled, false) THEN
    RETURN QUERY SELECT false, 'RIFA_DESATIVADA'::text, NULL::uuid, NULL::text, NULL::integer, NULL::integer;
    RETURN;
  END IF;

  WITH pool AS (
    SELECT r.id, r.name, r.raffle_number
      FROM event_registrations r
     WHERE r.edition_id = p_edition_id
       AND r.raffle_number IS NOT NULL
       AND (v_elig <> 'QUALIFIED' OR r.qualified = true)
       AND (v_elig <> 'GIFT_REDEEMED' OR EXISTS (
             SELECT 1 FROM event_gift_redemptions g
              WHERE g.registration_id = r.id AND g.status = 'RETIRADO'))
       AND (p_for_date IS NULL
            OR (r.created_at AT TIME ZONE 'America/Sao_Paulo')::date = p_for_date)
       AND (v_repeat OR NOT EXISTS (
             SELECT 1 FROM event_raffle_draws d WHERE d.registration_id = r.id))
  )
  SELECT p.id, p.name, p.raffle_number, count(*) OVER ()
    INTO v_win, v_name, v_num, v_pool
    FROM pool p
    ORDER BY random()
    LIMIT 1;

  IF v_win IS NULL THEN
    RETURN QUERY SELECT false, 'NENHUM_ELEGIVEL'::text, NULL::uuid, NULL::text, NULL::integer, 0;
    RETURN;
  END IF;

  INSERT INTO event_raffle_draws(edition_id, registration_id, raffle_number, prize, pool_size, drawn_for_date, drawn_by)
    VALUES (p_edition_id, v_win, v_num, v_prize, v_pool, p_for_date, auth.uid());

  RETURN QUERY SELECT true, 'SORTEADO'::text, v_win, v_name, v_num, v_pool;
END $$;
REVOKE EXECUTE ON FUNCTION public.raffle_draw(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.raffle_draw(uuid, date) TO authenticated;
