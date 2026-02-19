-- PRESTADOR não pode editar/alterar status de pedidos
DROP POLICY IF EXISTS "orders_update" ON orders;
CREATE POLICY "orders_update" ON orders FOR UPDATE
  USING (
    get_user_role() IN ('MASTER', 'GESTOR')
    OR assigned_to = auth.uid()
  );
