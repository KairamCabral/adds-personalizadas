-- Idempotência do envio de Lead à Meta Conversions API a partir do formulário
-- público de orçamento. Espelha o que 20260703120000 fez para orders/Purchase.
--
-- Por que o orçamento e não o clique no WhatsApp: o formulário traz nome,
-- e-mail e telefone reais, então a correspondência no Meta é alta. O clique no
-- botão do quiz não carrega dado nenhum do usuário.
alter table public.public_quotes
  add column if not exists meta_capi_sent_at timestamptz;

comment on column public.public_quotes.meta_capi_sent_at is
  'Quando o Lead deste orçamento foi enviado à Meta Conversions API. NULL = não enviado (idempotência do cron meta-capi-dispatch).';

-- Índice parcial: o cron varre só os orçamentos ainda não enviados.
create index if not exists idx_public_quotes_meta_capi_pending
  on public.public_quotes (created_at)
  where meta_capi_sent_at is null;
