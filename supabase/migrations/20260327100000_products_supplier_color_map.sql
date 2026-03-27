-- ============================================
-- ADDS CRM — Migration: supplier_color_map
-- ============================================
-- Adiciona mapeamento de variações por cor para fornecedor
-- Estrutura: { "branco": { "sku": "FORN-BR-001", "cost": 8.50 }, ... }
-- Mesma chave (key) de available_colors e tiny_color_map.

ALTER TABLE products ADD COLUMN IF NOT EXISTS
  supplier_color_map JSONB DEFAULT NULL;
