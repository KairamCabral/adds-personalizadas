-- RPCs para reordenação de pedidos no Kanban (evitar conflitos de position)

-- Fechar gap quando um card sai da coluna (decrementar posições acima)
CREATE OR REPLACE FUNCTION reorder_after_remove(
  p_status order_status,
  p_removed_position INTEGER
)
RETURNS void AS $$
BEGIN
  UPDATE orders
  SET position = position - 1
  WHERE status = p_status
    AND position > p_removed_position;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Abrir espaço quando um card entra na coluna (incrementar posições a partir do ponto de inserção)
CREATE OR REPLACE FUNCTION reorder_before_insert(
  p_status order_status,
  p_insert_position INTEGER,
  p_exclude_order_id UUID
)
RETURNS void AS $$
BEGIN
  UPDATE orders
  SET position = position + 1
  WHERE status = p_status
    AND position >= p_insert_position
    AND id != p_exclude_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
