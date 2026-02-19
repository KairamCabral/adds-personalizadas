-- ============================================
-- ADDS CRM — Migration: Product Colors
-- ============================================
-- Adiciona available_colors e allows_custom_color para o novo formulário de pedido

ALTER TABLE products ADD COLUMN IF NOT EXISTS
  available_colors JSONB DEFAULT '[]'::jsonb;

ALTER TABLE products ADD COLUMN IF NOT EXISTS
  allows_custom_color BOOLEAN DEFAULT true;

UPDATE products SET available_colors = '[
  {"key": "branco", "label": "Branco", "hex": "#FFFFFF"},
  {"key": "preto", "label": "Preto", "hex": "#000000"}
]'::jsonb
WHERE available_colors = '[]'::jsonb OR available_colors IS NULL;
