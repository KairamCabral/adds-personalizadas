-- Alinha reorder_column com positions 0..n-1 (resto do app / move_order_atomic)
CREATE OR REPLACE FUNCTION reorder_column(
  p_status order_status,
  p_order_ids UUID[]
)
RETURNS void AS $$
DECLARE
  i INTEGER;
BEGIN
  FOR i IN 1..array_length(p_order_ids, 1) LOOP
    UPDATE orders SET position = i - 1, status = p_status
    WHERE id = p_order_ids[i];
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
