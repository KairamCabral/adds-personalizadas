-- ============================================
-- ADDS CRM — Products: leitura pública para formulário de orçamento
-- ============================================
-- Permite que o formulário público /quote leia produtos ativos sem autenticação

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Leitura pública: apenas produtos ativos (formulário de orçamento sem auth)
CREATE POLICY "products_public_read" ON products FOR SELECT
  USING (is_active = true);

-- Usuários autenticados (MASTER/GESTOR) podem ver todos os produtos
CREATE POLICY "products_select" ON products FOR SELECT
  USING (get_user_role() IN ('MASTER', 'GESTOR'));

-- Inserção/atualização/remoção apenas para MASTER/GESTOR (dashboard)
CREATE POLICY "products_insert" ON products FOR INSERT
  WITH CHECK (get_user_role() IN ('MASTER', 'GESTOR'));
CREATE POLICY "products_update" ON products FOR UPDATE
  USING (get_user_role() IN ('MASTER', 'GESTOR'));
CREATE POLICY "products_delete" ON products FOR DELETE
  USING (get_user_role() IN ('MASTER', 'GESTOR'));
