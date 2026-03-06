-- RPC atômica para mover pedido entre colunas ou reordenar na mesma coluna
-- Substitui as chamadas separadas reorder_after_remove + reorder_before_insert + update

CREATE OR REPLACE FUNCTION move_order_atomic(
  p_order_id UUID,
  p_new_status order_status,
  p_new_position INTEGER
)
RETURNS void AS $$
DECLARE
  v_old_status order_status;
  v_old_position INTEGER;
BEGIN
  -- 1. Buscar status/posição atual
  SELECT status, position INTO v_old_status, v_old_position
  FROM orders WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;

  -- 2. Se mudou de coluna
  IF v_old_status != p_new_status THEN
    -- Fechar gap na coluna de origem
    UPDATE orders
    SET position = position - 1
    WHERE status = v_old_status
      AND position > v_old_position
      AND id != p_order_id;

    -- Abrir espaço na coluna destino
    UPDATE orders
    SET position = position + 1
    WHERE status = p_new_status
      AND position >= p_new_position
      AND id != p_order_id;

  -- 3. Se mesma coluna, reordenar
  ELSE
    IF v_old_position < p_new_position THEN
      -- Movendo para baixo: decrementar os que estão entre old e new
      UPDATE orders
      SET position = position - 1
      WHERE status = v_old_status
        AND position > v_old_position
        AND position <= p_new_position
        AND id != p_order_id;
    ELSIF v_old_position > p_new_position THEN
      -- Movendo para cima: incrementar os que estão entre new e old
      UPDATE orders
      SET position = position + 1
      WHERE status = v_old_status
        AND position >= p_new_position
        AND position < v_old_position
        AND id != p_order_id;
    END IF;
  END IF;

  -- 4. Atualizar o card arrastado
  UPDATE orders
  SET status = p_new_status,
      position = p_new_position,
      updated_at = now()
  WHERE id = p_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
