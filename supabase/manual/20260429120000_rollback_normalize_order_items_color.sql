-- ROLLBACK manual da migration 20260429120000_normalize_order_items_color.sql
--
-- ATENÇÃO: este arquivo NÃO é aplicado por `supabase db push`. Está fora de
-- supabase/migrations/ de propósito. Rodar manualmente no SQL Editor (Supabase
-- Studio) só se a migration tiver causado problema.
--
-- Restaura product_name, color e color_name das linhas afetadas usando a
-- tabela de snapshot criada pela migration original.

BEGIN;

UPDATE order_items oi
SET
  product_name = b.product_name,
  color = b.color,
  color_name = b.color_name
FROM order_items_backup_20260429120000 b
WHERE oi.id = b.id;

-- Após confirmar que tudo voltou ao estado anterior, remova o snapshot:
--   DROP TABLE order_items_backup_20260429120000;

COMMIT;
