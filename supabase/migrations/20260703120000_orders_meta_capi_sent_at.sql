-- Idempotência do envio de Purchase à Meta Conversions API (Nível 2 do tracking).
-- NULL = pedido faturado ainda não enviado ao Meta; timestamp = enviado com sucesso.
alter table public.orders
  add column if not exists meta_capi_sent_at timestamptz;

comment on column public.orders.meta_capi_sent_at is
  'Quando o Purchase deste pedido foi enviado à Meta Conversions API. NULL = não enviado (idempotência do cron meta-capi-dispatch).';

-- Índice parcial: o cron busca pedidos faturados (tiny_invoice_id preenchido)
-- que ainda não foram enviados. Mantém a varredura barata conforme a base cresce.
create index if not exists idx_orders_meta_capi_pending
  on public.orders (created_at)
  where meta_capi_sent_at is null and tiny_invoice_id is not null;
