-- Gestor pode excluir pedidos (cards), alinhado a orders.delete no app
DROP POLICY IF EXISTS "orders_delete" ON orders;
CREATE POLICY "orders_delete" ON orders FOR DELETE
  USING (get_user_role() IN ('MASTER', 'GESTOR'));
