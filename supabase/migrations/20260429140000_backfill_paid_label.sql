-- Backfill da label PAGO em pedidos com tiny_order_id que estão num status terminal
-- (APROVADO/PRODUCAO/EXPEDICAO/FINALIZADO/ENTREGUE/FATURADO) mas perderam o gatilho
-- de aplyPagoCrmFromTiny. Também adiciona ENTREGUE em pedidos em status ENTREGUE
-- que não receberam a label, e remove labels obsoletas de "aguardando pagamento".
--
-- Idempotente: rodar 2× é no-op no segundo passe.
-- Snapshot em order_labels_backup_20260429140000 com tracking de cada insert/delete
-- para permitir rollback exato.
-- Rollback manual: ver supabase/manual/20260429140000_rollback_backfill_paid_label.sql

BEGIN;

-- 1) Tabela de snapshot com tracking explícito
CREATE TABLE IF NOT EXISTS order_labels_backup_20260429140000 (
  op text NOT NULL CHECK (op IN ('DELETED', 'INSERTED')),
  order_id uuid NOT NULL,
  label label_type NOT NULL,
  original_id uuid,
  original_created_at timestamptz,
  backed_up_at timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE order_labels_backup_20260429140000 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "master_only" ON order_labels_backup_20260429140000;
CREATE POLICY "master_only" ON order_labels_backup_20260429140000
  FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'MASTER')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'MASTER');

-- 2) Snapshot das labels AGUARDANDO_* que serão removidas
INSERT INTO order_labels_backup_20260429140000 (op, order_id, label, original_id, original_created_at)
SELECT 'DELETED', l.order_id, l.label, l.id, l.created_at
FROM order_labels l
WHERE l.label IN ('AGUARDANDO_PAGAMENTO', 'APROV_AGUARDANDO_PAGAMENTO')
  AND l.order_id IN (
    SELECT o.id FROM orders o
    WHERE o.tiny_order_id IS NOT NULL
      AND o.deleted_at IS NULL
      AND o.archived_at IS NULL
      AND o.status IN ('APROVADO','PRODUCAO','EXPEDICAO','FINALIZADO','ENTREGUE','FATURADO')
  );

-- 3) Inserir label PAGO em pedidos elegíveis e registrar no snapshot
WITH inserted_pago AS (
  INSERT INTO order_labels (order_id, label)
  SELECT o.id, 'PAGO'::label_type
  FROM orders o
  WHERE o.tiny_order_id IS NOT NULL
    AND o.deleted_at IS NULL
    AND o.archived_at IS NULL
    AND o.status IN ('APROVADO','PRODUCAO','EXPEDICAO','FINALIZADO','ENTREGUE','FATURADO')
    AND NOT EXISTS (
      SELECT 1 FROM order_labels l WHERE l.order_id = o.id AND l.label = 'PAGO'
    )
  RETURNING order_id, label
)
INSERT INTO order_labels_backup_20260429140000 (op, order_id, label)
SELECT 'INSERTED', order_id, label FROM inserted_pago;

-- 4) Inserir label ENTREGUE em pedidos em status ENTREGUE sem essa label
WITH inserted_entregue AS (
  INSERT INTO order_labels (order_id, label)
  SELECT o.id, 'ENTREGUE'::label_type
  FROM orders o
  WHERE o.tiny_order_id IS NOT NULL
    AND o.deleted_at IS NULL
    AND o.archived_at IS NULL
    AND o.status = 'ENTREGUE'
    AND NOT EXISTS (
      SELECT 1 FROM order_labels l WHERE l.order_id = o.id AND l.label = 'ENTREGUE'
    )
  RETURNING order_id, label
)
INSERT INTO order_labels_backup_20260429140000 (op, order_id, label)
SELECT 'INSERTED', order_id, label FROM inserted_entregue;

-- 5) Remover labels obsoletas de aguardando pagamento (já temos PAGO agora)
DELETE FROM order_labels
WHERE label IN ('AGUARDANDO_PAGAMENTO', 'APROV_AGUARDANDO_PAGAMENTO')
  AND order_id IN (
    SELECT o.id FROM orders o
    WHERE o.tiny_order_id IS NOT NULL
      AND o.deleted_at IS NULL
      AND o.archived_at IS NULL
      AND o.status IN ('APROVADO','PRODUCAO','EXPEDICAO','FINALIZADO','ENTREGUE','FATURADO')
  );

COMMIT;
