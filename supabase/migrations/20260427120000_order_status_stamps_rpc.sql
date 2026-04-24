-- Carimbo da entrada na etapa atual (Kanban): último evento em order_history
-- com new_value = status atual (status_changed ou created).

CREATE OR REPLACE FUNCTION order_status_stamps(p_order_ids uuid[])
RETURNS TABLE (order_id uuid, entered_status_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id,
    COALESCE(
      (
        SELECT MAX(h.created_at)
        FROM order_history h
        WHERE h.order_id = o.id
          AND h.new_value = o.status::text
          AND (h.action = 'status_changed' OR h.action = 'created')
      ),
      o.created_at
    )
  FROM orders o
  WHERE o.id = ANY(p_order_ids);
$$;

GRANT EXECUTE ON FUNCTION order_status_stamps(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION order_status_stamps(uuid[]) TO service_role;

COMMENT ON FUNCTION order_status_stamps IS
'Para cada pedido: instante em que entrou no status atual (histórico ou created_at).';
