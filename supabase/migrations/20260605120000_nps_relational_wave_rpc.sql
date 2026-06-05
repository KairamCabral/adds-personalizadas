-- =============================================================================
-- NPS — RPC atômico da onda relacional (corrige duplicação + blast cego).
-- Faz o anti-join de cooldown direto no Postgres (sem o teto de 1000 linhas do
-- PostgREST que truncava a query no client e gerava disparos duplicados).
-- p_dry_run=true: só retorna a contagem de elegíveis (preview, sem inserir).
-- Idempotente / re-rodável.
--
-- IMPACTO MULTI-APP: função nova, sem alterar tabelas. Não afeta o rep-app.
-- Segurança: SECURITY DEFINER, mas valida get_user_role() ∈ (MASTER,GESTOR)
-- (defesa em profundidade além da RLS) e usa auth.uid() em created_by.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.nps_run_relational_wave(
  p_survey_id uuid,
  p_dry_run   boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_survey public.nps_surveys%ROWTYPE;
  v_count  integer;
BEGIN
  IF public.get_user_role() <> ALL (ARRAY['MASTER','GESTOR']::user_role[]) THEN
    RAISE EXCEPTION 'Sem permissão para disparar ondas de NPS.';
  END IF;

  SELECT * INTO v_survey
  FROM public.nps_surveys
  WHERE id = p_survey_id AND type = 'RELACIONAL' AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campanha relacional ativa não encontrada.';
  END IF;

  -- serializa ondas concorrentes da MESMA campanha (evita duplicar por 2 cliques)
  PERFORM pg_advisory_xact_lock(hashtext('nps_wave:' || p_survey_id::text));

  -- elegíveis: e-mail não vazio + canal compatível + fora do cooldown (qualquer
  -- disparo recente, anti-fadiga cross-survey) + ainda sem disparo desta campanha
  CREATE TEMP TABLE _nps_wave_elig ON COMMIT DROP AS
  SELECT c.id AS client_id, NULLIF(trim(c.email), '') AS email
  FROM public.clients c
  WHERE NULLIF(trim(c.email), '') IS NOT NULL
    AND (v_survey.sales_channel IS NULL OR c.sales_channel = v_survey.sales_channel)
    AND NOT EXISTS (
      SELECT 1 FROM public.nps_dispatches d
      WHERE d.client_id = c.id
        AND d.created_at > now() - make_interval(days => v_survey.cooldown_days)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.nps_dispatches d2
      WHERE d2.client_id = c.id AND d2.survey_id = p_survey_id
    );

  SELECT count(*) INTO v_count FROM _nps_wave_elig;

  IF p_dry_run THEN
    RETURN v_count;
  END IF;

  INSERT INTO public.nps_dispatches
    (survey_id, client_id, channel, status, recipient_email, scheduled_for, expires_at, created_by)
  SELECT
    p_survey_id, e.client_id, 'EMAIL', 'PENDENTE', e.email, now(),
    now() + make_interval(days => v_survey.expires_after_days), auth.uid()
  FROM _nps_wave_elig e;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.nps_run_relational_wave(uuid, boolean) TO authenticated, service_role;
