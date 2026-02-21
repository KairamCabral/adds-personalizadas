-- Dashboard de clientes: APENAS dados do CRM (tiny_id IS NULL)
-- Filtro de datas aplicado em: novosNoPeriodo, topClientes
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
  v_result json;
BEGIN
  -- Total: só clientes CRM (cadastrados no pipeline, não do Tiny)
  SELECT COUNT(*) INTO v_total FROM clients WHERE tiny_id IS NULL;

  -- Novos no período: só clientes CRM criados no intervalo
  SELECT COUNT(*) INTO v_novos FROM clients
  WHERE tiny_id IS NULL
    AND created_at >= p_from
    AND created_at <= p_to;

  v_result := json_build_object(
    'totalClientes', v_total,
    'novosNoPeriodo', v_novos,
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
    ),
    'porEstado', (
      SELECT COALESCE(json_agg(row_to_json(e)), '[]'::json)
      FROM (
        SELECT COALESCE(state, 'Não informado') as estado, COUNT(*)::int as quantidade
        FROM clients
        WHERE tiny_id IS NULL
        GROUP BY COALESCE(state, 'Não informado')
        ORDER BY COUNT(*) DESC
        LIMIT 10
      ) e
    )
  );

  RETURN v_result;
END;
$$;
