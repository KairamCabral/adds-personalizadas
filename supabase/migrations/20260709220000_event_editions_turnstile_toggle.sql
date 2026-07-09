-- =====================================================================
-- Congressos — Break-glass do Turnstile por edição
-- Adiciona event_editions.turnstile_enabled (default true).
--
-- APLICAÇÃO: manual, via Supabase Dashboard → SQL Editor, APÓS o merge do PR.
-- (Migrations NÃO são aplicadas automaticamente no deploy.)
-- SEM BEGIN/COMMIT (o SQL Editor não suporta transação explícita).
-- Idempotente: seguro reexecutar (ADD COLUMN IF NOT EXISTS).
--
-- MOTIVO: o Turnstile virou dependência dura do pré-cadastro público. Se o
--   Cloudflare/widget falhar no wi-fi do pavilhão, o cadastro trava. Este flag
--   permite desligar a verificação anti-robô SÓ naquela edição, em emergência,
--   sem redeploy nem mexer em variável de ambiente. O padrão continua LIGADO.
--
-- IMPACTO MULTI-APP (banco compartilhado com adds-rep-app):
--   SEGURO. `event_editions` NÃO é lida pelo adds-rep-app (mobile). A coluna é
--   aditiva, NOT NULL com DEFAULT true → linhas existentes ganham true
--   automaticamente; nenhuma query/RLS existente muda. Nenhuma tabela rep_*/
--   clients/orders/profiles é tocada.
-- =====================================================================

ALTER TABLE public.event_editions
  ADD COLUMN IF NOT EXISTS turnstile_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.event_editions.turnstile_enabled IS
  'Break-glass: desligar só em emergência (falha do Cloudflare no evento) para o pré-cadastro público não travar.';
