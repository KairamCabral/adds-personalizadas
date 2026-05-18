-- Backfill: pedidos cancelados via Tiny ficaram em limbo (status='ARQUIVADO'
-- mas archived_at=NULL) porque o re-sync antigo só mexia em status. O Kanban
-- esconde a coluna ARQUIVADO e a aba Arquivados filtra archived_at IS NOT NULL,
-- então esses pedidos não apareciam em lugar nenhum até serem desarquivados.
--
-- Esta migration:
--   1) Snapshot dos pedidos afetados (orders_canceled_backfill_backup_20260518150000)
--   2) Seta archived_at = updated_at (proxy razoável da data do cancelamento)
--   3) Adiciona label PEDIDO_CANCELADO (idempotente)
--
-- Não toca em status — pode ficar como ARQUIVADO; o que importa pra UX é
-- aparecer em Arquivados, e ao reativar o user move pra coluna desejada.
--
-- Idempotente: rodar 2× é no-op no segundo passe (filtros archived_at IS NULL
-- e NOT EXISTS em order_labels).

BEGIN;

-- 1) Snapshot pra rollback
CREATE TABLE IF NOT EXISTS orders_canceled_backfill_backup_20260518150000 (
  op text NOT NULL CHECK (op IN ('ARCHIVED_AT_SET', 'LABEL_INSERTED')),
  order_id uuid NOT NULL,
  previous_archived_at timestamptz,
  applied_archived_at timestamptz,
  backed_up_at timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE orders_canceled_backfill_backup_20260518150000 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "master_only" ON orders_canceled_backfill_backup_20260518150000;
CREATE POLICY "master_only" ON orders_canceled_backfill_backup_20260518150000
  FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'MASTER')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'MASTER');

-- 2) Setar archived_at = updated_at nos pedidos em limbo + snapshot
WITH updated_orders AS (
  UPDATE orders
  SET archived_at = updated_at
  WHERE status = 'ARQUIVADO'
    AND archived_at IS NULL
    AND deleted_at IS NULL
    AND tiny_order_id IS NOT NULL
  RETURNING id, archived_at
)
INSERT INTO orders_canceled_backfill_backup_20260518150000
  (op, order_id, previous_archived_at, applied_archived_at)
SELECT 'ARCHIVED_AT_SET', id, NULL, archived_at FROM updated_orders;

-- 3) Inserir label PEDIDO_CANCELADO em pedidos arquivados com tiny_order_id
--    que ainda não têm essa label (cobre tanto os recém-corrigidos acima
--    quanto eventuais arquivamentos manuais cuja origem foi o Tiny)
WITH inserted_labels AS (
  INSERT INTO order_labels (order_id, label)
  SELECT o.id, 'PEDIDO_CANCELADO'::label_type
  FROM orders o
  WHERE o.status = 'ARQUIVADO'
    AND o.archived_at IS NOT NULL
    AND o.deleted_at IS NULL
    AND o.tiny_order_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM order_labels l
      WHERE l.order_id = o.id AND l.label = 'PEDIDO_CANCELADO'
    )
  RETURNING order_id
)
INSERT INTO orders_canceled_backfill_backup_20260518150000
  (op, order_id, previous_archived_at, applied_archived_at)
SELECT 'LABEL_INSERTED', order_id, NULL, NULL FROM inserted_labels;

COMMIT;
