-- Lixeira de pedidos: soft-delete com purge automático em 30 dias
-- A aplicação substitui o DELETE direto por UPDATE deleted_at = now().
-- O cron /api/cron/cleanup apaga permanentemente linhas com deleted_at < now() - 30 dias.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN orders.deleted_at IS
  'Preenchido quando o pedido é movido para a lixeira (soft-delete). NULL = ativo. Deletado permanentemente pelo cron após 30 dias.';

CREATE INDEX IF NOT EXISTS idx_orders_deleted_at
  ON orders (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- Policy de leitura da lixeira: somente MASTER e GESTOR
DROP POLICY IF EXISTS "orders_trash_read" ON orders;
CREATE POLICY "orders_trash_read" ON orders FOR SELECT
  USING (
    deleted_at IS NULL
    OR get_user_role() IN ('MASTER', 'GESTOR')
  );

-- Policy de restore (UPDATE deleted_at → null)
DROP POLICY IF EXISTS "orders_restore" ON orders;
CREATE POLICY "orders_restore" ON orders FOR UPDATE
  USING (get_user_role() IN ('MASTER', 'GESTOR'));
