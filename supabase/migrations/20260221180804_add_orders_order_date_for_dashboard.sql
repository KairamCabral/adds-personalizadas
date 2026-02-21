-- Coluna para data real do pedido (Tiny: data do pedido; CRM: created_at)
-- Usada no dashboard para filtrar por período de negócio, não por data de sincronização
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_date DATE;

-- Índice para filtros do dashboard
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders (order_date) WHERE order_date IS NOT NULL;

-- Backfill: pedidos do Tiny usam created_at (não temos data do Tiny em histórico)
-- Novos syncs preencherão order_date. Para pedidos CRM, order_date = created_at::date
UPDATE orders 
SET order_date = (created_at AT TIME ZONE 'America/Sao_Paulo')::date 
WHERE order_date IS NULL;

COMMENT ON COLUMN orders.order_date IS 'Data do pedido no negócio. Para Tiny: data_pedido da API. Para CRM: created_at. Usado no dashboard.';
