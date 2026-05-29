-- ============================================
-- ADDS CRM — Motor de preços (Fase 3): RLS de escrita para o painel admin
-- ============================================
-- As tabelas pricing_* foram criadas pelo app mobile (adds-rep-app), que as LÊ
-- ao vivo. Hoje só existe RLS de SELECT para `authenticated`. Esta migration
-- adiciona INSERT/UPDATE/DELETE para MASTER/GESTOR (painel web), SEM tocar nas
-- policies de SELECT — portanto não afeta a leitura do rep-app.

ALTER TABLE pricing_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_volume_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_settings ENABLE ROW LEVEL SECURITY;

-- pricing_tiers ---------------------------------------------------------------
DROP POLICY IF EXISTS "pricing_tiers_admin_insert" ON pricing_tiers;
CREATE POLICY "pricing_tiers_admin_insert" ON pricing_tiers FOR INSERT
  WITH CHECK (get_user_role() IN ('MASTER', 'GESTOR'));

DROP POLICY IF EXISTS "pricing_tiers_admin_update" ON pricing_tiers;
CREATE POLICY "pricing_tiers_admin_update" ON pricing_tiers FOR UPDATE
  USING (get_user_role() IN ('MASTER', 'GESTOR'))
  WITH CHECK (get_user_role() IN ('MASTER', 'GESTOR'));

DROP POLICY IF EXISTS "pricing_tiers_admin_delete" ON pricing_tiers;
CREATE POLICY "pricing_tiers_admin_delete" ON pricing_tiers FOR DELETE
  USING (get_user_role() IN ('MASTER', 'GESTOR'));

-- pricing_volume_discounts ----------------------------------------------------
DROP POLICY IF EXISTS "pricing_volume_discounts_admin_insert" ON pricing_volume_discounts;
CREATE POLICY "pricing_volume_discounts_admin_insert" ON pricing_volume_discounts FOR INSERT
  WITH CHECK (get_user_role() IN ('MASTER', 'GESTOR'));

DROP POLICY IF EXISTS "pricing_volume_discounts_admin_update" ON pricing_volume_discounts;
CREATE POLICY "pricing_volume_discounts_admin_update" ON pricing_volume_discounts FOR UPDATE
  USING (get_user_role() IN ('MASTER', 'GESTOR'))
  WITH CHECK (get_user_role() IN ('MASTER', 'GESTOR'));

DROP POLICY IF EXISTS "pricing_volume_discounts_admin_delete" ON pricing_volume_discounts;
CREATE POLICY "pricing_volume_discounts_admin_delete" ON pricing_volume_discounts FOR DELETE
  USING (get_user_role() IN ('MASTER', 'GESTOR'));

-- pricing_settings (singleton, sem delete) ------------------------------------
DROP POLICY IF EXISTS "pricing_settings_admin_insert" ON pricing_settings;
CREATE POLICY "pricing_settings_admin_insert" ON pricing_settings FOR INSERT
  WITH CHECK (get_user_role() IN ('MASTER', 'GESTOR'));

DROP POLICY IF EXISTS "pricing_settings_admin_update" ON pricing_settings;
CREATE POLICY "pricing_settings_admin_update" ON pricing_settings FOR UPDATE
  USING (get_user_role() IN ('MASTER', 'GESTOR'))
  WITH CHECK (get_user_role() IN ('MASTER', 'GESTOR'));
