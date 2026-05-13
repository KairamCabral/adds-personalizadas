-- Atualiza recompute_supplier_inventory para classificar divergência POR LINHA.
--
-- Substitui a versão anterior (20260512200000) que agregava por (produto, cor).
-- Agora que cada pool tem seu próprio depósito Tiny configurado, cada linha
-- (produto, cor, pool) tem seu próprio tiny_quantity específico do depósito —
-- a comparação volta a ser por linha individual, simples e correta.
--
-- Regras:
-- - BREAK: pool PERSONALIZADO com committed > declared
-- - DIVERGE: |tiny - declared| / max(1, declared) * 100 > threshold_pct
-- - MISSING_TINY: tiny_quantity é NULL
-- - MATCH: caso contrário

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

  -- 1) Atualiza quantity_committed nos itens PERSONALIZADO conforme carteira corrente
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

  UPDATE supplier_inventory_items it
     SET quantity_committed = 0
   WHERE it.inventory_id = p_inventory_id
     AND it.pool = 'PERSONALIZADO'
     AND NOT EXISTS (
       SELECT 1 FROM compute_supplier_committed(v_supplier_id) c
        WHERE c.product_id = it.product_id
          AND COALESCE(c.color_key, '') = COALESCE(it.color_key, '')
     );

  -- 2) Marketplace nunca tem committed
  UPDATE supplier_inventory_items
     SET quantity_committed = 0
   WHERE inventory_id = p_inventory_id
     AND pool = 'MARKETPLACE'
     AND quantity_committed <> 0;

  -- 3) Classificação POR LINHA (cada pool tem seu próprio tiny_quantity)
  UPDATE supplier_inventory_items
     SET divergence_status = CASE
       WHEN pool = 'PERSONALIZADO' AND quantity_committed > quantity_declared THEN 'BREAK'
       WHEN tiny_quantity IS NULL THEN 'MISSING_TINY'
       WHEN abs(tiny_quantity - quantity_declared)::numeric / GREATEST(1, quantity_declared) * 100 > v_threshold THEN 'DIVERGE'
       ELSE 'MATCH'
     END
   WHERE inventory_id = p_inventory_id;
END $$;

COMMENT ON FUNCTION recompute_supplier_inventory(UUID) IS
  'Recompute do inventário com classificação POR LINHA. Cada pool tem seu próprio tiny_quantity (depósito Tiny específico configurado em products.tiny_deposito_*_id).';
