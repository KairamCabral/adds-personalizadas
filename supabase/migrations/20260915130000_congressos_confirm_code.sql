-- =====================================================================
-- Congressos — Confirmação da retirada por código no WhatsApp
--
-- O operador do estande passa a poder mandar um código de 4 dígitos pelo
-- WhatsApp (envio MANUAL, via wa.me — sem API) e conferir com o participante
-- antes de liberar o brinde. A entrega SEM código continua possível, mas
-- passa a ficar registrada como tal (`redeem_verification`).
--
-- Também habilita a busca por telefone no console de retirada
-- (`event_registrations.phone_digits`, coluna gerada).
--
-- APLICAÇÃO: manual, via Supabase Dashboard → SQL Editor, APÓS o merge do PR.
-- SEM BEGIN/COMMIT (o SQL Editor não suporta transação explícita).
-- Idempotente: guards de enum, IF NOT EXISTS, CREATE OR REPLACE.
--
-- IMPACTO MULTI-APP (banco compartilhado com adds-rep-app):
--   Só toca tabelas `event_*`, exclusivas do módulo Congressos (web) — o
--   rep-app não lê nenhuma delas. Colunas novas são ADITIVAS e nullable.
--   ATENÇÃO: `redeem_gift(text)` é SUBSTITUÍDA por `redeem_gift(text, text)`.
--   No CRM o único chamador é src/services/congressos-gifts.service.ts.
--   Conferir que o rep-app não chama esse RPC antes de aplicar.
-- =====================================================================

-- 1) ENUM (guardado) ---------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.event_redeem_verification AS ENUM ('CODIGO','SEM_CODIGO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) COLUNAS -----------------------------------------------------------

-- Telefone só com dígitos, para busca no balcão. O telefone é gravado ora
-- formatado ("(11) 91234-5678"), ora cru, conforme a origem do pré-cadastro
-- (wizard público ou espelho do cliente) — daí a coluna gerada.
ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS phone_digits text
  GENERATED ALWAYS AS (regexp_replace(COALESCE(phone,''), '[^0-9]', '', 'g')) STORED;

CREATE INDEX IF NOT EXISTS idx_event_registrations_phone_digits
  ON public.event_registrations(phone_digits);

-- Código de confirmação + como a retirada foi validada.
ALTER TABLE public.event_gift_redemptions
  ADD COLUMN IF NOT EXISTS confirm_code text,
  ADD COLUMN IF NOT EXISTS confirm_code_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirm_code_phone text,
  ADD COLUMN IF NOT EXISTS redeem_verification public.event_redeem_verification;

COMMENT ON COLUMN public.event_gift_redemptions.confirm_code IS
  '4 dígitos enviados ao participante pelo WhatsApp (envio manual via wa.me).';
COMMENT ON COLUMN public.event_gift_redemptions.confirm_code_phone IS
  'Telefone (só dígitos) para o qual o código vigente foi gerado.';
COMMENT ON COLUMN public.event_gift_redemptions.redeem_verification IS
  'Como a retirada foi validada: CODIGO (conferido no WhatsApp) ou SEM_CODIGO.';

-- 3) RPC: emitir/reaproveitar o código de confirmação -------------------
-- Gate de papel idêntico ao redeem_gift (operate: MASTER/GESTOR/PRESTADOR).
-- Reaproveita o código vigente quando tem menos de 10 min E foi gerado para o
-- mesmo telefone: clicar duas vezes não invalida o código que a pessoa já
-- recebeu. Devolve o telefone autoritativo para o front montar o link wa.me.
CREATE OR REPLACE FUNCTION public.issue_gift_confirm_code(p_token text)
RETURNS TABLE(
  success boolean,
  outcome text,
  code text,
  phone text,
  participant_name text,
  edition_name text,
  gift_name text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role user_role;
  v_id uuid;
  v_status public.event_gift_status;
  v_code text;
  v_sent_at timestamptz;
  v_code_phone text;
  v_phone text;
  v_phone_digits text;
  v_name text;
  v_edition text;
  v_gift text;
BEGIN
  v_role := get_user_role();
  IF v_role IS NULL OR v_role <> ALL (ARRAY['MASTER','GESTOR','PRESTADOR']::user_role[]) THEN
    RETURN QUERY SELECT false, 'SEM_PERMISSAO'::text, NULL::text, NULL::text,
                        NULL::text, NULL::text, NULL::text;
    RETURN;
  END IF;

  SELECT g.id, g.status, g.confirm_code, g.confirm_code_sent_at, g.confirm_code_phone,
         reg.phone, reg.phone_digits, reg.name, e.name, e.gift_name
    INTO v_id, v_status, v_code, v_sent_at, v_code_phone,
         v_phone, v_phone_digits, v_name, v_edition, v_gift
    FROM event_gift_redemptions g
    JOIN event_registrations reg ON reg.id = g.registration_id
    JOIN event_editions e        ON e.id  = g.edition_id
   WHERE g.token = p_token;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'NAO_ENCONTRADO'::text, NULL::text, NULL::text,
                        NULL::text, NULL::text, NULL::text;
    RETURN;
  END IF;

  IF v_status = 'RETIRADO' THEN
    RETURN QUERY SELECT false, 'JA_RETIRADO'::text, NULL::text, v_phone,
                        v_name, v_edition, v_gift;
    RETURN;
  ELSIF v_status = 'CANCELADO' THEN
    RETURN QUERY SELECT false, 'CANCELADO'::text, NULL::text, v_phone,
                        v_name, v_edition, v_gift;
    RETURN;
  END IF;

  IF v_phone_digits IS NULL OR length(v_phone_digits) < 10 THEN
    RETURN QUERY SELECT false, 'SEM_TELEFONE'::text, NULL::text, v_phone,
                        v_name, v_edition, v_gift;
    RETURN;
  END IF;

  IF v_code IS NULL
     OR v_sent_at IS NULL
     OR v_sent_at < now() - interval '10 minutes'
     OR v_code_phone IS DISTINCT FROM v_phone_digits THEN
    v_code := lpad((floor(random() * 10000))::int::text, 4, '0');
    UPDATE event_gift_redemptions
       SET confirm_code = v_code,
           confirm_code_sent_at = now(),
           confirm_code_phone = v_phone_digits
     WHERE id = v_id;
  END IF;

  RETURN QUERY SELECT true, 'OK'::text, v_code, v_phone, v_name, v_edition, v_gift;
END $$;

REVOKE EXECUTE ON FUNCTION public.issue_gift_confirm_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_gift_confirm_code(text) TO authenticated;

-- 4) RPC: retirada atômica, agora com código opcional -------------------
-- Substitui redeem_gift(text). Regras:
--   • código informado e diferente do vigente → CODIGO_INVALIDO, nada é
--     consumido (o participante pode reler a mensagem);
--   • código correto  → redeem_verification = 'CODIGO';
--   • sem código      → redeem_verification = 'SEM_CODIGO' (entrega continua
--     possível — fila andando, participante sem o celular na mão).
DROP FUNCTION IF EXISTS public.redeem_gift(text);

CREATE OR REPLACE FUNCTION public.redeem_gift(
  p_token text,
  p_confirm_code text DEFAULT NULL
)
RETURNS TABLE(
  success boolean,
  outcome text,
  redeemed_at timestamptz,
  redeemed_by_name text,
  verification text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role user_role;
  v_id uuid; v_status public.event_gift_status;
  v_at timestamptz; v_by uuid;
  v_code text;
  v_verification public.event_redeem_verification;
BEGIN
  v_role := get_user_role();
  IF v_role IS NULL OR v_role <> ALL (ARRAY['MASTER','GESTOR','PRESTADOR']::user_role[]) THEN
    RETURN QUERY SELECT false, 'SEM_PERMISSAO'::text, NULL::timestamptz, NULL::text, NULL::text;
    RETURN;
  END IF;

  -- "" e NULL significam a mesma coisa: entrega sem confirmação por código.
  v_code := NULLIF(regexp_replace(COALESCE(p_confirm_code, ''), '[^0-9]', '', 'g'), '');
  v_verification := CASE WHEN v_code IS NULL THEN 'SEM_CODIGO' ELSE 'CODIGO' END;

  UPDATE event_gift_redemptions
     SET status='RETIRADO', redeemed_at=now(), redeemed_by=auth.uid(),
         redeem_verification = v_verification
   WHERE token=p_token AND status='PENDENTE'
     AND (v_code IS NULL OR confirm_code = v_code)
   RETURNING event_gift_redemptions.id, event_gift_redemptions.redeemed_at
        INTO v_id, v_at;

  IF FOUND THEN
    RETURN QUERY SELECT true, 'RETIRADO'::text, v_at,
      (SELECT full_name FROM profiles WHERE id = auth.uid()),
      v_verification::text;
    RETURN;
  END IF;

  SELECT g.id, g.status, g.redeemed_at, g.redeemed_by
    INTO v_id, v_status, v_at, v_by
    FROM event_gift_redemptions g WHERE g.token = p_token;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'NAO_ENCONTRADO'::text, NULL::timestamptz, NULL::text, NULL::text;
    RETURN;
  ELSIF v_status='RETIRADO' THEN
    RETURN QUERY SELECT false, 'JA_RETIRADO'::text, v_at,
      (SELECT full_name FROM profiles WHERE id = v_by), NULL::text;
    RETURN;
  ELSIF v_status='CANCELADO' THEN
    RETURN QUERY SELECT false, 'CANCELADO'::text, NULL::timestamptz, NULL::text, NULL::text;
    RETURN;
  END IF;

  -- Continua PENDENTE: o UPDATE só não pegou porque o código não confere.
  RETURN QUERY SELECT false, 'CODIGO_INVALIDO'::text, NULL::timestamptz, NULL::text, NULL::text;
END $$;

-- Supabase concede EXECUTE a anon diretamente (default privileges), não só via PUBLIC.
REVOKE EXECUTE ON FUNCTION public.redeem_gift(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_gift(text, text) TO authenticated;
