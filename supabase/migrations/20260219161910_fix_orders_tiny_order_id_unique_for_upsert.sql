-- Corrige índice único parcial incompatível com ON CONFLICT do Supabase
-- O índice parcial (WHERE tiny_order_id IS NOT NULL) não é reconhecido pelo upsert

-- Remover índice único parcial
DROP INDEX IF EXISTS idx_orders_tiny_order_id_unique;

-- Criar índice UNIQUE não parcial (PostgreSQL permite múltiplos NULL em colunas UNIQUE)
CREATE UNIQUE INDEX idx_orders_tiny_order_id_unique 
ON orders (tiny_order_id);
