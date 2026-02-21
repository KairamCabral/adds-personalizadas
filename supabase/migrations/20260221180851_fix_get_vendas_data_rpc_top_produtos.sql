-- RPC para dashboard de vendas: agregação no banco, sem limite 1000, usa order_date quando disponível
CREATE OR REPLACE FUNCTION get_vendas_data(p_from timestamptz, p_to timestamptz)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from_date date := (p_from AT TIME ZONE 'America/Sao_Paulo')::date;
  v_to_date date := (p_to AT TIME ZONE 'America/Sao_Paulo')::date;
  v_result json;
  v_finished text[] := ARRAY['FINALIZADO','ENTREGUE','FATURADO'];
BEGIN
  WITH ord AS (
    SELECT o.id, o.status, o.order_type, o.tiny_order_id,
           COALESCE(o.order_date, (o.created_at AT TIME ZONE 'America/Sao_Paulo')::date) AS dt
    FROM orders o
    WHERE COALESCE(o.order_date, (o.created_at AT TIME ZONE 'America/Sao_Paulo')::date) >= v_from_date
      AND COALESCE(o.order_date, (o.created_at AT TIME ZONE 'America/Sao_Paulo')::date) <= v_to_date
      AND o.archived_at IS NULL
  ),
  ord_items AS (
    SELECT oi.order_id, oi.product_id, oi.product_name, oi.quantity, oi.total_price,
           o.status, o.tiny_order_id, o.dt
    FROM order_items oi
    JOIN ord o ON o.id = oi.order_id
  ),
  agg AS (
    SELECT
      COUNT(DISTINCT o.id)::int AS total_orders,
      COUNT(DISTINCT o.id) FILTER (WHERE o.status::text = ANY(v_finished))::int AS finished_orders,
      COALESCE(SUM(oi.total_price) FILTER (WHERE o.status::text = ANY(v_finished)), 0)::numeric AS faturamento
    FROM ord o
    LEFT JOIN order_items oi ON oi.order_id = o.id
  ),
  crm_agg AS (
    SELECT
      COUNT(DISTINCT o.id)::int AS total,
      COUNT(DISTINCT o.id) FILTER (WHERE o.status::text = ANY(v_finished))::int AS finished,
      COALESCE(SUM(oi.total_price) FILTER (WHERE o.status::text = ANY(v_finished)), 0)::numeric AS faturamento
    FROM ord o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    WHERE o.tiny_order_id IS NULL
  ),
  tiny_agg AS (
    SELECT
      COUNT(DISTINCT o.id)::int AS total,
      COUNT(DISTINCT o.id) FILTER (WHERE o.status::text = ANY(v_finished))::int AS finished,
      COALESCE(SUM(oi.total_price) FILTER (WHERE o.status::text = ANY(v_finished)), 0)::numeric AS faturamento
    FROM ord o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    WHERE o.tiny_order_id IS NOT NULL
  ),
  ts_data AS (
    SELECT TO_CHAR(o.dt, 'DD/MM') AS d, o.dt AS dt_sort,
           SUM(COALESCE(oi.total_price, 0))::numeric AS v
    FROM ord o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    WHERE o.status::text = ANY(v_finished)
    GROUP BY o.dt
  ),
  top_prod AS (
    SELECT oi.product_name AS nome, SUM(oi.quantity)::int AS quantidade, SUM(COALESCE(oi.total_price, 0))::numeric AS receita
    FROM ord_items oi
    JOIN ord o ON o.id = oi.order_id
    GROUP BY COALESCE(oi.product_id::text, oi.product_name), oi.product_name
    ORDER BY SUM(oi.quantity) DESC
    LIMIT 5
  )
  SELECT json_build_object(
    'totalOrders', (SELECT total_orders FROM agg),
    'finishedOrders', (SELECT finished_orders FROM agg),
    'faturamento', (SELECT faturamento FROM agg),
    'ticketMedio', CASE WHEN (SELECT finished_orders FROM agg) > 0 
      THEN (SELECT faturamento FROM agg) / (SELECT finished_orders FROM agg) ELSE 0 END,
    'timeSeries', (SELECT COALESCE(json_agg(json_build_object('data', d, 'vendas', v) ORDER BY dt_sort DESC), '[]'::json) FROM ts_data),
    'topProdutos', (SELECT COALESCE(json_agg(json_build_object('nome', nome, 'quantidade', quantidade, 'receita', receita)), '[]'::json) FROM top_prod),
    'porTipo', (
      SELECT COALESCE(json_agg(json_build_object('tipo', tipo, 'quantidade', quantidade)), '[]'::json)
      FROM (
        SELECT o.order_type::text AS tipo, COUNT(*)::int AS quantidade
        FROM ord o
        GROUP BY o.order_type
      ) pt
    ),
    'crm', (
      SELECT json_build_object('totalOrders', total, 'finishedOrders', finished, 'faturamento', faturamento)
      FROM crm_agg
    ),
    'tiny', (
      SELECT json_build_object('totalOrders', total, 'finishedOrders', finished, 'faturamento', faturamento)
      FROM tiny_agg
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;
