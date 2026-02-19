-- Fix RBAC: PRESTADOR ver todos os pedidos (com ações limitadas)
-- e PRESTADOR ler clients para exibir dados nos cards

-- Orders: PRESTADOR pode ver todos os pedidos
DROP POLICY IF EXISTS "orders_select" ON orders;
CREATE POLICY "orders_select" ON orders FOR SELECT
  USING (
    get_user_role() IN ('MASTER', 'GESTOR', 'PRESTADOR')
    OR assigned_to = auth.uid()
    OR EXISTS (SELECT 1 FROM order_watchers WHERE order_id = orders.id AND user_id = auth.uid())
  );

-- Orders: PRESTADOR pode atualizar pedidos (mudar status, editar)
DROP POLICY IF EXISTS "orders_update" ON orders;
CREATE POLICY "orders_update" ON orders FOR UPDATE
  USING (
    get_user_role() IN ('MASTER', 'GESTOR', 'PRESTADOR')
    OR assigned_to = auth.uid()
  );

-- Clients: PRESTADOR pode ler para exibir nome/logo nos cards
DROP POLICY IF EXISTS "clients_select" ON clients;
CREATE POLICY "clients_select" ON clients FOR SELECT
  USING (get_user_role() IN ('MASTER', 'GESTOR', 'PRESTADOR'));
