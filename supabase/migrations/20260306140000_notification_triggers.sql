-- ============================================
-- ADDS CRM — Triggers de Notificação
-- ============================================
-- Cria notificações para: mudança de status, novo comentário,
-- novo pedido e novo orçamento público.

-- ============================================
-- 1. NOTIFICAÇÃO AO MUDAR STATUS DO PEDIDO
-- ============================================
CREATE OR REPLACE FUNCTION notify_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_title TEXT;
  v_order_title TEXT;
  v_order_number INT;
  v_actor_name TEXT;
BEGIN
  -- Só disparar se o status realmente mudou
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Buscar dados do pedido
  v_order_title := NEW.title;
  v_order_number := NEW.order_number;

  -- Buscar nome de quem fez a mudança
  SELECT full_name INTO v_actor_name
  FROM profiles WHERE id = auth.uid();

  -- Notificar criador (se não for ele mesmo que mudou)
  IF NEW.created_by IS NOT NULL AND NEW.created_by != auth.uid() THEN
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (
      NEW.created_by,
      'status_changed',
      'Status alterado',
      format('%s moveu #%s para %s', COALESCE(v_actor_name, 'Sistema'), v_order_number, NEW.status),
      jsonb_build_object('order_id', NEW.id, 'old_status', OLD.status, 'new_status', NEW.status)
    );
  END IF;

  -- Notificar responsável (se diferente do criador e de quem fez)
  IF NEW.assigned_to IS NOT NULL
     AND NEW.assigned_to != auth.uid()
     AND NEW.assigned_to IS DISTINCT FROM NEW.created_by THEN
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (
      NEW.assigned_to,
      'status_changed',
      'Status alterado',
      format('%s moveu #%s para %s', COALESCE(v_actor_name, 'Sistema'), v_order_number, NEW.status),
      jsonb_build_object('order_id', NEW.id, 'old_status', OLD.status, 'new_status', NEW.status)
    );
  END IF;

  -- Notificar watchers
  INSERT INTO notifications (user_id, type, title, message, data)
  SELECT
    ow.user_id,
    'status_changed',
    'Status alterado',
    format('%s moveu #%s para %s', COALESCE(v_actor_name, 'Sistema'), v_order_number, NEW.status),
    jsonb_build_object('order_id', NEW.id, 'old_status', OLD.status, 'new_status', NEW.status)
  FROM order_watchers ow
  WHERE ow.order_id = NEW.id
    AND ow.user_id != auth.uid()
    AND ow.user_id IS DISTINCT FROM NEW.created_by
    AND ow.user_id IS DISTINCT FROM NEW.assigned_to;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_status_change ON orders;
CREATE TRIGGER trg_notify_status_change
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_status_change();

-- ============================================
-- 2. NOTIFICAÇÃO AO ADICIONAR COMENTÁRIO
-- ============================================
-- Tabela: comments (order_id, user_id, id)
CREATE OR REPLACE FUNCTION notify_comment_added()
RETURNS TRIGGER AS $$
DECLARE
  v_order_title TEXT;
  v_order_number INT;
  v_order_created_by UUID;
  v_order_assigned_to UUID;
  v_actor_name TEXT;
BEGIN
  -- Buscar dados do pedido
  SELECT title, order_number, created_by, assigned_to
  INTO v_order_title, v_order_number, v_order_created_by, v_order_assigned_to
  FROM orders WHERE id = NEW.order_id;

  -- Buscar nome de quem comentou
  SELECT full_name INTO v_actor_name
  FROM profiles WHERE id = NEW.user_id;

  -- Notificar criador do pedido (se não for ele que comentou)
  IF v_order_created_by IS NOT NULL AND v_order_created_by != NEW.user_id THEN
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (
      v_order_created_by,
      'comment_added',
      'Novo comentário',
      format('%s comentou no pedido #%s', COALESCE(v_actor_name, 'Alguém'), v_order_number),
      jsonb_build_object('order_id', NEW.order_id, 'comment_id', NEW.id)
    );
  END IF;

  -- Notificar responsável
  IF v_order_assigned_to IS NOT NULL
     AND v_order_assigned_to != NEW.user_id
     AND v_order_assigned_to IS DISTINCT FROM v_order_created_by THEN
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (
      v_order_assigned_to,
      'comment_added',
      'Novo comentário',
      format('%s comentou no pedido #%s', COALESCE(v_actor_name, 'Alguém'), v_order_number),
      jsonb_build_object('order_id', NEW.order_id, 'comment_id', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_comment ON comments;
CREATE TRIGGER trg_notify_comment
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_comment_added();

-- ============================================
-- 3. NOTIFICAÇÃO AO CRIAR NOVO PEDIDO
-- ============================================
CREATE OR REPLACE FUNCTION notify_order_created()
RETURNS TRIGGER AS $$
DECLARE
  v_actor_name TEXT;
  v_user_rec RECORD;
BEGIN
  -- Buscar nome de quem criou
  SELECT full_name INTO v_actor_name
  FROM profiles WHERE id = NEW.created_by;

  -- Notificar todos os MASTER e GESTOR (exceto quem criou)
  FOR v_user_rec IN
    SELECT id FROM profiles
    WHERE role IN ('MASTER', 'GESTOR')
      AND id != COALESCE(NEW.created_by, '00000000-0000-0000-0000-000000000000')
      AND is_active = true
  LOOP
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (
      v_user_rec.id,
      'order_created',
      'Novo pedido',
      format('%s criou o pedido #%s: %s', COALESCE(v_actor_name, 'Sistema'), NEW.order_number, LEFT(NEW.title, 60)),
      jsonb_build_object('order_id', NEW.id)
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_order_created ON orders;
CREATE TRIGGER trg_notify_order_created
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_order_created();

-- ============================================
-- 4. NOTIFICAÇÃO AO RECEBER ORÇAMENTO PÚBLICO
-- ============================================
CREATE OR REPLACE FUNCTION notify_quote_received()
RETURNS TRIGGER AS $$
DECLARE
  v_user_rec RECORD;
BEGIN
  -- Notificar todos os MASTER e GESTOR
  FOR v_user_rec IN
    SELECT id FROM profiles
    WHERE role IN ('MASTER', 'GESTOR')
      AND is_active = true
  LOOP
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (
      v_user_rec.id,
      'quote_received',
      'Novo orçamento recebido',
      format('%s enviou um orçamento público', NEW.client_name),
      jsonb_build_object('quote_id', NEW.id, 'client_name', NEW.client_name)
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_quote ON public_quotes;
CREATE TRIGGER trg_notify_quote
  AFTER INSERT ON public_quotes
  FOR EACH ROW
  EXECUTE FUNCTION notify_quote_received();
