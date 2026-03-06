-- ============================================
-- ADDS CRM — Migration: Bling SKU mapping em products
-- ============================================
-- Adiciona mapeamento de SKU do Bling por cor para envio de pedidos de venda

ALTER TABLE products ADD COLUMN IF NOT EXISTS bling_sku TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS bling_color_sku_map JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN products.bling_sku IS 'SKU do produto no Bling do fornecedor (para produtos sem variação de cor)';
COMMENT ON COLUMN products.bling_color_sku_map IS 'Mapa de cor→SKU do Bling. Ex: {"amarela": "PRD00011A", "lilas": "PRD00011L"}';
