-- Fase 1: Inventário no fornecedor (fundação interna)
-- Cria: pools, colunas em products, supplier_inventories, supplier_inventory_items,
-- RPC compute_supplier_committed, trigger de recompute em orders,
-- suppliers.inventory_config e RLS (MASTER full, GESTOR read).
-- Role FORNECEDOR e alertas entram nas Fases 2/3 em migrations separadas.

-- 1) Pools (depósitos lógicos)
CREATE TYPE supplier_inventory_pool AS ENUM ('PERSONALIZADO', 'MARKETPLACE');

-- 2) Status do inventário
CREATE TYPE supplier_inventory_status AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- 3) Colunas em products: vínculo com fornecedor + pools + depósitos Tiny por pool
ALTER TABLE products
  ADD COLUMN inventory_supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  ADD COLUMN inventory_pools supplier_inventory_pool[] NOT NULL DEFAULT '{}',
  ADD COLUMN tiny_deposito_personalizado_id BIGINT,
  ADD COLUMN tiny_deposito_marketplace_id BIGINT;

CREATE INDEX idx_products_inventory_supplier
  ON products(inventory_supplier_id)
  WHERE inventory_supplier_id IS NOT NULL;

CREATE INDEX idx_products_inventory_pools
  ON products USING GIN (inventory_pools)
  WHERE array_length(inventory_pools, 1) > 0;

-- 4) Config de inventário por fornecedor
ALTER TABLE suppliers
  ADD COLUMN inventory_config JSONB NOT NULL DEFAULT
  '{
    "committed_statuses": ["APROVADO", "PRODUCAO", "EXPEDICAO"],
    "committed_order_types": ["PERSONALIZADO", "RUSH", "PROMOCIONAL"],
    "divergence_threshold_pct": 10,
    "auto_create_drafts": true,
    "cron_sync_enabled": true
  }'::jsonb;

-- 5) Header do inventário mensal
CREATE TABLE supplier_inventories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  reference_month DATE NOT NULL,
  status supplier_inventory_status NOT NULL DEFAULT 'DRAFT',
  source TEXT NOT NULL DEFAULT 'internal',
  submitted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ,
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejected_reason TEXT,
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT supplier_inventories_month_first_day CHECK (reference_month = date_trunc('month', reference_month)::date),
  CONSTRAINT supplier_inventories_unique_month UNIQUE (supplier_id, reference_month)
);

CREATE INDEX idx_sup_inv_supplier_month
  ON supplier_inventories(supplier_id, reference_month DESC);

CREATE INDEX idx_sup_inv_status
  ON supplier_inventories(status)
  WHERE status IN ('DRAFT', 'SUBMITTED');

CREATE TRIGGER trg_sup_inv_updated
  BEFORE UPDATE ON supplier_inventories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 6) Itens do inventário (1 linha por produto/cor/pool)
CREATE TABLE supplier_inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID NOT NULL REFERENCES supplier_inventories(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  color_key TEXT,
  pool supplier_inventory_pool NOT NULL,
  quantity_declared INTEGER NOT NULL DEFAULT 0,
  quantity_committed INTEGER NOT NULL DEFAULT 0,
  quantity_balance INTEGER GENERATED ALWAYS AS (quantity_declared - quantity_committed) STORED,
  tiny_quantity INTEGER,
  tiny_synced_at TIMESTAMPTZ,
  divergence_status TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sup_inv_items_qty_nonneg CHECK (quantity_declared >= 0 AND quantity_committed >= 0),
  CONSTRAINT sup_inv_items_divergence_valid CHECK (
    divergence_status IS NULL OR divergence_status IN
    ('MATCH', 'DIVERGE', 'MISSING_TINY', 'BREAK', 'COMMITTED_GT_DECLARED')
  )
);

-- Uniqueness: NULL color_key precisa ser tratado (NULLs não colidem no UNIQUE padrão)
-- Usamos índice único com COALESCE para garantir 1 linha por (inv, produto, cor, pool)
CREATE UNIQUE INDEX uq_sup_inv_items_combo
  ON supplier_inventory_items (inventory_id, product_id, COALESCE(color_key, ''), pool);

CREATE INDEX idx_sup_inv_items_inventory
  ON supplier_inventory_items(inventory_id);

CREATE INDEX idx_sup_inv_items_product_pool
  ON supplier_inventory_items(product_id, pool);

CREATE INDEX idx_sup_inv_items_break
  ON supplier_inventory_items(inventory_id)
  WHERE divergence_status IN ('BREAK', 'COMMITTED_GT_DECLARED');

CREATE TRIGGER trg_sup_inv_items_updated
  BEFORE UPDATE ON supplier_inventory_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 7) RPC: calcula carteira (committed) em tempo real por fornecedor
--    Agrega order_items.quantity de pedidos PERSONALIZADO em status configurados,
--    excluindo arquivados e deletados.
CREATE OR REPLACE FUNCTION compute_supplier_committed(p_supplier_id UUID)
RETURNS TABLE (product_id UUID, color_key TEXT, committed INT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH cfg AS (
    SELECT
      COALESCE(inventory_config->'committed_statuses',
               '["APROVADO","PRODUCAO","EXPEDICAO"]'::jsonb) AS statuses,
      COALESCE(inventory_config->'committed_order_types',
               '["PERSONALIZADO","RUSH","PROMOCIONAL"]'::jsonb) AS order_types
    FROM suppliers WHERE id = p_supplier_id
  )
  SELECT
    oi.product_id,
    oi.color AS color_key,
    SUM(oi.quantity)::int AS committed
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  JOIN products p ON p.id = oi.product_id
  CROSS JOIN cfg
  WHERE p.inventory_supplier_id = p_supplier_id
    AND 'PERSONALIZADO'::supplier_inventory_pool = ANY(p.inventory_pools)
    AND o.status::text IN (SELECT jsonb_array_elements_text(cfg.statuses))
    AND o.order_type::text IN (SELECT jsonb_array_elements_text(cfg.order_types))
    AND o.archived_at IS NULL
    AND o.deleted_at IS NULL
  GROUP BY oi.product_id, oi.color;
$$;

-- 8) Helper: classifica divergência para um item baseado nos valores atuais
CREATE OR REPLACE FUNCTION classify_inventory_divergence(
  p_declared INT,
  p_committed INT,
  p_tiny INT,
  p_threshold_pct NUMERIC
) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_committed > p_declared THEN 'BREAK'
    WHEN p_tiny IS NULL THEN 'MISSING_TINY'
    WHEN abs(p_tiny - p_declared)::numeric / GREATEST(1, p_declared) * 100 > p_threshold_pct THEN 'DIVERGE'
    ELSE 'MATCH'
  END;
$$;

-- 9) Recompute completo de um inventory (committed via RPC + classify)
CREATE OR REPLACE FUNCTION recompute_supplier_inventory(p_inventory_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_supplier_id UUID;
  v_threshold NUMERIC;
BEGIN
  SELECT i.supplier_id,
         COALESCE((s.inventory_config->>'divergence_threshold_pct')::numeric, 10)
    INTO v_supplier_id, v_threshold
  FROM supplier_inventories i
  JOIN suppliers s ON s.id = i.supplier_id
  WHERE i.id = p_inventory_id;

  IF v_supplier_id IS NULL THEN
    RETURN;
  END IF;

  -- Atualiza quantity_committed apenas para itens PERSONALIZADO
  WITH committed AS (
    SELECT * FROM compute_supplier_committed(v_supplier_id)
  )
  UPDATE supplier_inventory_items it
     SET quantity_committed = COALESCE(c.committed, 0)
    FROM committed c
   WHERE it.inventory_id = p_inventory_id
     AND it.pool = 'PERSONALIZADO'
     AND it.product_id = c.product_id
     AND COALESCE(it.color_key, '') = COALESCE(c.color_key, '');

  -- Zera committed em itens PERSONALIZADO que não casam com nenhum pedido
  UPDATE supplier_inventory_items it
     SET quantity_committed = 0
   WHERE it.inventory_id = p_inventory_id
     AND it.pool = 'PERSONALIZADO'
     AND NOT EXISTS (
       SELECT 1 FROM compute_supplier_committed(v_supplier_id) c
        WHERE c.product_id = it.product_id
          AND COALESCE(c.color_key, '') = COALESCE(it.color_key, '')
     );

  -- Reclassifica divergência em todos os itens do inventory
  UPDATE supplier_inventory_items
     SET divergence_status = classify_inventory_divergence(
       quantity_declared, quantity_committed, tiny_quantity, v_threshold
     )
   WHERE inventory_id = p_inventory_id;
END $$;

-- 10) Trigger em orders: recomputa inventories abertos do mês corrente
--     dos fornecedores afetados quando status ou order_type muda.
CREATE OR REPLACE FUNCTION trg_orders_recompute_inventory()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inv_id UUID;
  v_order_id UUID;
BEGIN
  v_order_id := COALESCE(NEW.id, OLD.id);

  -- Skip se nada relevante mudou no UPDATE
  IF TG_OP = 'UPDATE'
     AND OLD.status IS NOT DISTINCT FROM NEW.status
     AND OLD.order_type IS NOT DISTINCT FROM NEW.order_type
     AND OLD.archived_at IS NOT DISTINCT FROM NEW.archived_at
     AND OLD.deleted_at IS NOT DISTINCT FROM NEW.deleted_at THEN
    RETURN NEW;
  END IF;

  -- Para cada inventory aberto (DRAFT/SUBMITTED) afetado, recompute
  FOR v_inv_id IN
    SELECT DISTINCT i.id
    FROM supplier_inventories i
    JOIN products p ON p.inventory_supplier_id = i.supplier_id
    JOIN order_items oi ON oi.product_id = p.id
   WHERE oi.order_id = v_order_id
     AND i.status IN ('DRAFT', 'SUBMITTED')
     AND i.reference_month = date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')::date
  LOOP
    PERFORM recompute_supplier_inventory(v_inv_id);
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_orders_inventory_recompute
  AFTER INSERT OR UPDATE OR DELETE ON orders
  FOR EACH ROW EXECUTE FUNCTION trg_orders_recompute_inventory();

-- 11) RLS — Fase 1: MASTER full, GESTOR read; FORNECEDOR/portal entra em Fase 2
ALTER TABLE supplier_inventories ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY supplier_inventories_master_all ON supplier_inventories
  FOR ALL
  USING (get_user_role() = 'MASTER')
  WITH CHECK (get_user_role() = 'MASTER');

CREATE POLICY supplier_inventories_gestor_read ON supplier_inventories
  FOR SELECT
  USING (get_user_role() = 'GESTOR');

CREATE POLICY supplier_inventory_items_master_all ON supplier_inventory_items
  FOR ALL
  USING (get_user_role() = 'MASTER')
  WITH CHECK (get_user_role() = 'MASTER');

CREATE POLICY supplier_inventory_items_gestor_read ON supplier_inventory_items
  FOR SELECT
  USING (get_user_role() = 'GESTOR');

-- 12) Comentários para documentação
COMMENT ON TABLE supplier_inventories IS
  'Header de cada inventário mensal do fornecedor. Único por (supplier_id, reference_month).';
COMMENT ON TABLE supplier_inventory_items IS
  'Linhas do inventário: 1 por (produto, cor, pool). quantity_balance = declared - committed.';
COMMENT ON COLUMN supplier_inventory_items.divergence_status IS
  'BREAK=committed>declared (ruptura); DIVERGE=|tiny-declared|>threshold; MISSING_TINY=tiny null; MATCH=ok.';
COMMENT ON FUNCTION compute_supplier_committed(UUID) IS
  'Agrega quantity de order_items para pedidos PERSONALIZADO em status committed_statuses. Não inclui arquivados/deletados.';
