-- Atualiza recompute_supplier_inventory para classificar divergência de
-- forma agregada por (produto, cor), em vez de por linha individual.
--
-- Motivação: a API Tiny v3 OAuth padrão não expõe estoque por depósito,
-- apenas o saldo total agregado por variante. Assim, ambos os pools
-- (PERSONALIZADO e MARKETPLACE) da mesma cor recebem o mesmo tiny_quantity,
-- e a divergência Tiny vs Declarado faz sentido apenas se considerarmos a
-- SOMA dos pools comparada com o total Tiny daquela cor.
--
-- Regras:
-- - BREAK (CRITICAL) — por LINHA: quando committed > declared no pool
--   PERSONALIZADO. Marketplace nunca tem committed (sempre 0), então nunca
--   gera BREAK.
-- - DIVERGE — por COR: quando |sum(declared dos pools) - tiny| > threshold%.
-- - MISSING_TINY — por COR: quando tiny_quantity é NULL.
-- - MATCH — caso contrário.
--
-- A linha PERSONALIZADO leva BREAK quando aplicável; demais linhas levam o
-- status agregado da cor.

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

  -- Zera committed em PERSONALIZADO sem pedido correspondente
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

  -- 3) Classificação agregada por (produto, cor):
  --    - Soma declared de TODOS os pools da mesma cor
  --    - Toma tiny_quantity da cor (já igual nas linhas, vem do mesmo total Tiny)
  --    - Classifica como MATCH/DIVERGE/MISSING_TINY
  --    - LINHA PERSONALIZADO com committed > declared sobrescreve para BREAK
  WITH agg AS (
    SELECT
      product_id,
      COALESCE(color_key, '') AS color_key_norm,
      SUM(quantity_declared) AS total_declared,
      MAX(tiny_quantity) AS tiny  -- todos iguais por cor; MAX ignora NULLs
    FROM supplier_inventory_items
    WHERE inventory_id = p_inventory_id
    GROUP BY product_id, COALESCE(color_key, '')
  ),
  classified AS (
    SELECT
      product_id,
      color_key_norm,
      tiny,
      total_declared,
      CASE
        WHEN tiny IS NULL THEN 'MISSING_TINY'
        WHEN abs(tiny - total_declared)::numeric / GREATEST(1, total_declared) * 100 > v_threshold THEN 'DIVERGE'
        ELSE 'MATCH'
      END AS color_status
    FROM agg
  )
  UPDATE supplier_inventory_items it
     SET divergence_status = CASE
       WHEN it.pool = 'PERSONALIZADO' AND it.quantity_committed > it.quantity_declared THEN 'BREAK'
       ELSE c.color_status
     END
    FROM classified c
   WHERE it.inventory_id = p_inventory_id
     AND it.product_id = c.product_id
     AND COALESCE(it.color_key, '') = c.color_key_norm;
END $$;

COMMENT ON FUNCTION recompute_supplier_inventory(UUID) IS
  'Recompute do inventário com classificação agregada por (produto, cor). API Tiny não expõe saldo por depósito, então tiny_quantity é o total da variante; divergência compara soma dos pools da cor vs total Tiny.';
