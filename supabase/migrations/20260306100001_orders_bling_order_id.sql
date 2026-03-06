-- ============================================
-- ADDS CRM — Migration: bling_order_id em orders
-- ============================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS bling_order_id BIGINT;

COMMENT ON COLUMN orders.bling_order_id IS 'ID do Pedido de Venda criado no Bling do fornecedor';
