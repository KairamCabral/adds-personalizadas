-- Remove distribuição por estado; adiciona totais de pedidos CRM (no período e ativos no pipeline)
CREATE OR REPLACE FUNCTION get_dashboard_clientes_data(
  p_from timestamptz,
  p_to timestamptz
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total bigint;
  v_novos bigint;
  v_pedidos_no_periodo bigint;
  v_pedidos_ativos bigint;
  v_result json;
BEGIN
  SELECT COUNT(*) INTO v_total FROM clients WHERE tiny_id IS NULL;

  SELECT COUNT(*) INTO v_novos FROM clients
  WHERE tiny_id IS NULL
    AND created_at >= p_from
    AND created_at <= p_to;

  SELECT COUNT(*) INTO v_pedidos_no_periodo FROM orders
  WHERE tiny_order_id IS NULL
    AND archived_at IS NULL
    AND created_at >= p_from
    AND created_at <= p_to;

  SELECT COUNT(*) INTO v_pedidos_ativos FROM orders
  WHERE tiny_order_id IS NULL AND archived_at IS NULL;

  v_result := json_build_object(
    'totalClientes', v_total,
    'novosNoPeriodo', v_novos,
    'totalPedidosNoPeriodo', v_pedidos_no_periodo,
    'totalPedidosAtivos', v_pedidos_ativos,
    'topClientes', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT c.id, c.name as nome, c.company as empresa, COUNT(o.id)::int as "totalPedidos"
        FROM clients c
        INNER JOIN orders o ON o.client_id = c.id
        WHERE c.tiny_id IS NULL
          AND o.tiny_order_id IS NULL
          AND o.created_at >= p_from
          AND o.created_at <= p_to
        GROUP BY c.id, c.name, c.company
        ORDER BY COUNT(o.id) DESC
        LIMIT 10
      ) t
    )
  );

  RETURN v_result;
END;
$$;
