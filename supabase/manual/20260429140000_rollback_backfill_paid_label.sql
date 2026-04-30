-- ROLLBACK manual da migration 20260429140000_backfill_paid_label.sql
--
-- ATENÇÃO: este arquivo NÃO é aplicado por `supabase db push`. Está fora de
-- supabase/migrations/ de propósito. Rodar manualmente no SQL Editor (Supabase
-- Studio) só se a migration tiver causado problema.
--
-- Reverte usando a tabela order_labels_backup_20260429140000:
--   - 'INSERTED' (PAGO/ENTREGUE adicionados pela migration) → DELETE
--   - 'DELETED'  (AGUARDANDO_* removidas pela migration)    → INSERT de volta

BEGIN;

-- 1) Remover labels que a migration adicionou
DELETE FROM order_labels ol
USING order_labels_backup_20260429140000 b
WHERE b.op = 'INSERTED'
  AND ol.order_id = b.order_id
  AND ol.label = b.label;

-- 2) Re-inserir labels que a migration removeu (preservando id e created_at originais)
INSERT INTO order_labels (id, order_id, label, created_at)
SELECT b.original_id, b.order_id, b.label, b.original_created_at
FROM order_labels_backup_20260429140000 b
WHERE b.op = 'DELETED'
  AND b.original_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- Após confirmar reversão completa, remover o snapshot:
--   DROP TABLE order_labels_backup_20260429140000;

COMMIT;
