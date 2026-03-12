-- ============================================
-- ADDS CRM — Fix: ADDS Ultra bling_color_sku_map
-- ============================================
-- Tabela do cliente: PRD00012A (azul), PRD00012L (laranja), PRD00012V (vermelho)
-- Inclui "vermelha" para match com personalização no CRM.
-- ============================================

UPDATE products
SET bling_color_sku_map = '{
  "azul": "PRD00012A",
  "laranja": "PRD00012L",
  "vermelho": "PRD00012V",
  "vermelha": "PRD00012V"
}'::jsonb
WHERE name ILIKE '%ultra%' AND is_active = true;
