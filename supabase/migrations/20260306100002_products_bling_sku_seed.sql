-- ============================================
-- ADDS CRM — Seed: Mapeamento SKU Bling (WS Dental)
-- ============================================
-- IMPORTANTE: Conferir os nomes dos produtos antes de rodar.
-- Verificar com: SELECT name FROM products WHERE is_active = true;
-- Ajustar os WHERE se os nomes forem diferentes.

-- ═══════════════════════════════════════════
-- ESCOVA ADDS IMPLANT EXTRA MACIA (por cor)
-- ═══════════════════════════════════════════
UPDATE products
SET bling_color_sku_map = '{
  "amarela": "PRD00011A",
  "lilas": "PRD00011L",
  "verde": "PRD00011V"
}'::jsonb
WHERE name ILIKE '%implant%' AND is_active = true;

-- ═══════════════════════════════════════════
-- ESCOVA ADDS ULTRA 11400 - ULTRA MACIA (por cor)
-- ═══════════════════════════════════════════
UPDATE products
SET bling_color_sku_map = '{
  "azul": "PRD00012A",
  "laranja": "PRD00012L",
  "vermelho": "PRD00012V"
}'::jsonb
WHERE name ILIKE '%ultra%' AND is_active = true;

-- ═══════════════════════════════════════════
-- PRODUTOS SEM VARIAÇÃO DE COR (SKU direto)
-- ═══════════════════════════════════════════
UPDATE products SET bling_sku = 'PRD0000CX'
WHERE name ILIKE '%caixa%branca%' AND is_active = true;

UPDATE products SET bling_sku = 'PRD00007'
WHERE name ILIKE '%cera%ortodontica%' AND is_active = true;

UPDATE products SET bling_sku = 'PRD00001'
WHERE name ILIKE '%interdental%conica%' AND is_active = true;

UPDATE products SET bling_sku = 'PRD00002'
WHERE name ILIKE '%interdental%ex%ex%fina%' AND is_active = true;

UPDATE products SET bling_sku = 'PRD00003'
WHERE name ILIKE '%interdental%extra fina%cart%' AND is_active = true;

UPDATE products SET bling_sku = 'PRD00004'
WHERE name ILIKE '%interdental%fina%cart%' AND is_active = true;

UPDATE products SET bling_sku = 'PRD00005'
WHERE name ILIKE '%interdental%media%' AND is_active = true;

UPDATE products SET bling_sku = 'PRD00008'
WHERE name ILIKE '%fio dental%' AND is_active = true;
