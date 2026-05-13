-- Previne duplicação de order_items por race de webhooks Tiny concorrentes.
--
-- Sintoma observado em 2026-05-13: pedidos #5561 e #5372 receberam 2 lotes
-- idênticos de itens (mesma color/quantity/product_id) com timestamps a <2ms
-- de diferença. Causa: importTinyOrderFromApi faz delete+insert não-atômico;
-- dois webhooks Tiny concorrentes (ex.: pedido + nota_fiscal) ambos deletam
-- antes de qualquer um inserir, depois ambos inserem.
--
-- Esta migration:
--  1) Snapshot das linhas que serão removidas.
--  2) Dedupe: mantém a linha mais antiga por (order_id, product_id, color).
--  3) UNIQUE INDEX que impede a recorrência ao nível de banco (raiz da defesa).
--
-- Rollback manual: DROP INDEX order_items_order_product_color_uniq;
--                  e restaurar de order_items_backup_20260513150000.

BEGIN;

-- 1) Snapshot das duplicatas que serão removidas
CREATE TABLE IF NOT EXISTS order_items_backup_20260513150000 AS
SELECT oi.*, NOW() AS backed_up_at
FROM order_items oi
WHERE EXISTS (
  SELECT 1
  FROM order_items oi2
  WHERE oi2.order_id = oi.order_id
    AND oi2.product_id IS NOT DISTINCT FROM oi.product_id
    AND oi2.color IS NOT DISTINCT FROM oi.color
    AND oi.product_id IS NOT NULL
    AND (oi2.created_at, oi2.id) < (oi.created_at, oi.id)
);

ALTER TABLE order_items_backup_20260513150000 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "master_only" ON order_items_backup_20260513150000;
CREATE POLICY "master_only" ON order_items_backup_20260513150000
  FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'MASTER')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'MASTER');

-- 2) Dedupe — mantém a linha mais antiga por (order_id, product_id, color)
DELETE FROM order_items oi
USING order_items oi2
WHERE oi.order_id = oi2.order_id
  AND oi.product_id IS NOT DISTINCT FROM oi2.product_id
  AND oi.color IS NOT DISTINCT FROM oi2.color
  AND oi.product_id IS NOT NULL
  AND (oi.created_at, oi.id) > (oi2.created_at, oi2.id);

-- 3) UNIQUE INDEX — defesa de banco contra race condition
--    COALESCE pra tratar color=NULL como chave válida única.
--    Restringe a product_id IS NOT NULL pra não bloquear itens órfãos legados
--    (product apagado via ON DELETE SET NULL).
CREATE UNIQUE INDEX IF NOT EXISTS order_items_order_product_color_uniq
  ON order_items (order_id, product_id, COALESCE(color, ''))
  WHERE product_id IS NOT NULL;

COMMIT;
