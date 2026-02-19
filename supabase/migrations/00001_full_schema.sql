-- ============================================
-- ADDS CRM — Migration 001: Full Schema
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE user_role AS ENUM ('MASTER', 'GESTOR', 'PRESTADOR');
CREATE TYPE order_status AS ENUM (
  'FAZER', 'AJUSTE', 'APROVACAO', 'AGUARDANDO_APROVACAO',
  'APROVADO', 'ARTE_APROVADA', 'PRODUCAO', 'EXPEDICAO',
  'FINALIZADO', 'ENTREGUE', 'FATURADO', 'ARQUIVADO'
);
CREATE TYPE order_priority AS ENUM ('NORMAL', 'ALTA');
CREATE TYPE order_type AS ENUM (
  'USUARIO', 'PERSONALIZADO', 'RUSH', 'PROMOCIONAL', 'ORCAMENTO_PUBLICO'
);
CREATE TYPE label_type AS ENUM (
  'BOLETO', 'AGUARDANDO_PAGAMENTO', 'PEDIDO_CANCELADO',
  'APROV_AGUARDANDO_PAGAMENTO', 'AMOSTRAS', 'PAGO', 'ORCAMENTO_PUBLICO'
);
CREATE TYPE artwork_status AS ENUM ('PENDENTE', 'APROVADA', 'AJUSTE_SOLICITADO');
CREATE TYPE quote_status AS ENUM (
  'PENDENTE', 'CONTACTADO', 'CONCLUIDO', 'APROVADO', 'REJEITADO'
);
CREATE TYPE person_type AS ENUM ('FISICA', 'JURIDICA');
CREATE TYPE audit_action AS ENUM (
  'LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE',
  'STATUS_CHANGE', 'LABEL_CHANGE',
  'ARTWORK_UPLOAD', 'ARTWORK_APPROVE', 'ARTWORK_REJECT',
  'SYNC_TINY', 'EXPORT'
);

-- ============================================
-- PROFILES
-- ============================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  role user_role NOT NULL DEFAULT 'PRESTADOR',
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  notification_preferences JSONB DEFAULT '{
    "order_created": {"in_app": true, "email": true},
    "status_changed": {"in_app": true, "email": true},
    "comment_added": {"in_app": true, "email": false},
    "mention": {"in_app": true, "email": true},
    "attachment_added": {"in_app": true, "email": false},
    "artwork_approved": {"in_app": true, "email": true},
    "artwork_adjustment": {"in_app": true, "email": true},
    "quote_received": {"in_app": true, "email": true},
    "system_alert": {"in_app": true, "email": true},
    "label_changed": {"in_app": true, "email": false}
  }'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- CLIENTS
-- ============================================

CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_type person_type NOT NULL DEFAULT 'FISICA',
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  document TEXT,
  logo_url TEXT,
  notes TEXT,
  zip_code TEXT,
  street TEXT,
  number TEXT,
  complement TEXT,
  neighborhood TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'Brasil',
  tiny_id BIGINT UNIQUE,
  tiny_synced_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_clients_name ON clients USING gin(name gin_trgm_ops);
CREATE INDEX idx_clients_document ON clients(document);
CREATE INDEX idx_clients_email ON clients(email);
CREATE INDEX idx_clients_tiny_id ON clients(tiny_id);

-- ============================================
-- PRODUCTS
-- ============================================

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2),
  category TEXT,
  product_type TEXT,
  stock INTEGER DEFAULT 0,
  image_url TEXT,
  canvas_width INTEGER,
  canvas_height INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  tiny_id BIGINT UNIQUE,
  tiny_code TEXT,
  tiny_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- ORDERS
-- ============================================

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number SERIAL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  status order_status NOT NULL DEFAULT 'FAZER',
  order_type order_type NOT NULL DEFAULT 'PERSONALIZADO',
  priority order_priority NOT NULL DEFAULT 'NORMAL',
  start_date DATE,
  due_date DATE,
  assigned_to UUID REFERENCES profiles(id),
  position INTEGER NOT NULL DEFAULT 0,
  tiny_order_id BIGINT,
  tiny_invoice_id BIGINT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_client ON orders(client_id);
CREATE INDEX idx_orders_assigned ON orders(assigned_to);
CREATE INDEX idx_orders_position ON orders(status, position);
CREATE INDEX idx_orders_due_date ON orders(due_date);

-- ============================================
-- ORDER_ITEMS
-- ============================================

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2),
  total_price DECIMAL(10,2),
  personalization JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);

-- ============================================
-- ORDER_LABELS
-- ============================================

CREATE TABLE order_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  label label_type NOT NULL,
  added_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(order_id, label)
);

CREATE INDEX idx_order_labels_order ON order_labels(order_id);

-- ============================================
-- ORDER_WATCHERS
-- ============================================

CREATE TABLE order_watchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(order_id, user_id)
);

-- ============================================
-- ARTWORKS
-- ============================================

CREATE TABLE artworks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_size INTEGER,
  status artwork_status NOT NULL DEFAULT 'PENDENTE',
  version INTEGER NOT NULL DEFAULT 1,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  adjustment_notes TEXT,
  is_internal_decision BOOLEAN DEFAULT false,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_artworks_order ON artworks(order_id);

-- ============================================
-- APPROVAL_TOKENS
-- ============================================

CREATE TABLE approval_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  artwork_id UUID NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  used_by_name TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_approval_tokens_token ON approval_tokens(token);

-- ============================================
-- COMMENTS
-- ============================================

CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  content TEXT NOT NULL,
  mentions UUID[] DEFAULT '{}',
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_comments_order ON comments(order_id);

-- ============================================
-- CHECKLISTS
-- ============================================

CREATE TABLE checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_by UUID REFERENCES profiles(id),
  completed_at TIMESTAMPTZ,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- ATTACHMENTS
-- ============================================

CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_attachments_order ON attachments(order_id);

-- ============================================
-- NOTIFICATIONS
-- ============================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  data JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE read_at IS NULL;

-- ============================================
-- AUDIT_LOGS
-- ============================================

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  action audit_action NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);

-- ============================================
-- PUBLIC_QUOTES
-- ============================================

CREATE TABLE public_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,
  client_whatsapp TEXT,
  client_document TEXT,
  client_city TEXT,
  client_state TEXT,
  client_zip_code TEXT,
  client_street TEXT,
  client_number TEXT,
  client_complement TEXT,
  client_neighborhood TEXT,
  client_social_media TEXT,
  client_logo_url TEXT,
  is_existing_client BOOLEAN DEFAULT false,
  existing_client_id UUID REFERENCES clients(id),
  items JSONB NOT NULL,
  personalization JSONB,
  estimated_value DECIMAL(10,2),
  status quote_status NOT NULL DEFAULT 'PENDENTE',
  assigned_to UUID REFERENCES profiles(id),
  internal_notes TEXT,
  order_id UUID REFERENCES orders(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_quotes_status ON public_quotes(status);

-- ============================================
-- ORDER_HISTORY
-- ============================================

CREATE TABLE order_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_history_order ON order_history(order_id);

-- ============================================
-- TINY_SYNC_LOGS
-- ============================================

CREATE TABLE tiny_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID,
  tiny_id BIGINT,
  direction TEXT NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_artworks_updated BEFORE UPDATE ON artworks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_comments_updated BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_quotes_updated BEFORE UPDATE ON public_quotes FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Log order status changes
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO order_history (order_id, user_id, action, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'status_changed', OLD.status::text, NEW.status::text);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_order_status_change AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION log_order_status_change();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'PRESTADOR')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Get current user role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Validate approval token
CREATE OR REPLACE FUNCTION validate_approval_token(p_token TEXT)
RETURNS TABLE (
  is_valid BOOLEAN,
  token_id UUID,
  order_id UUID,
  artwork_id UUID,
  order_title TEXT,
  artwork_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (at.used_at IS NULL AND at.expires_at > now()) AS is_valid,
    at.id AS token_id,
    at.order_id,
    at.artwork_id,
    o.title AS order_title,
    a.file_url AS artwork_url
  FROM approval_tokens at
  JOIN orders o ON o.id = at.order_id
  JOIN artworks a ON a.id = at.artwork_id
  WHERE at.token = p_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reorder column
CREATE OR REPLACE FUNCTION reorder_column(
  p_status order_status,
  p_order_ids UUID[]
)
RETURNS void AS $$
DECLARE
  i INTEGER;
BEGIN
  FOR i IN 1..array_length(p_order_ids, 1) LOOP
    UPDATE orders SET position = i, status = p_status
    WHERE id = p_order_ids[i];
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_watchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE artworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiny_sync_logs ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "profiles_update_admin" ON profiles FOR UPDATE
  USING (get_user_role() IN ('MASTER', 'GESTOR'));

-- Clients
CREATE POLICY "clients_select" ON clients FOR SELECT
  USING (get_user_role() IN ('MASTER', 'GESTOR'));
CREATE POLICY "clients_insert" ON clients FOR INSERT
  WITH CHECK (get_user_role() IN ('MASTER', 'GESTOR'));
CREATE POLICY "clients_update" ON clients FOR UPDATE
  USING (get_user_role() IN ('MASTER', 'GESTOR'));
CREATE POLICY "clients_delete" ON clients FOR DELETE
  USING (get_user_role() = 'MASTER');

-- Orders
CREATE POLICY "orders_select" ON orders FOR SELECT
  USING (
    get_user_role() IN ('MASTER', 'GESTOR')
    OR assigned_to = auth.uid()
    OR EXISTS (SELECT 1 FROM order_watchers WHERE order_id = orders.id AND user_id = auth.uid())
  );
CREATE POLICY "orders_insert" ON orders FOR INSERT
  WITH CHECK (get_user_role() IN ('MASTER', 'GESTOR'));
CREATE POLICY "orders_update" ON orders FOR UPDATE
  USING (
    get_user_role() IN ('MASTER', 'GESTOR')
    OR assigned_to = auth.uid()
  );
CREATE POLICY "orders_delete" ON orders FOR DELETE
  USING (get_user_role() = 'MASTER');

-- Order items (follow order access)
CREATE POLICY "order_items_select" ON order_items FOR SELECT USING (true);
CREATE POLICY "order_items_insert" ON order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "order_items_update" ON order_items FOR UPDATE USING (true);
CREATE POLICY "order_items_delete" ON order_items FOR DELETE USING (true);

-- Order labels
CREATE POLICY "order_labels_select" ON order_labels FOR SELECT USING (true);
CREATE POLICY "order_labels_insert" ON order_labels FOR INSERT
  WITH CHECK (get_user_role() IN ('MASTER', 'GESTOR'));
CREATE POLICY "order_labels_delete" ON order_labels FOR DELETE
  USING (get_user_role() IN ('MASTER', 'GESTOR'));

-- Order watchers
CREATE POLICY "order_watchers_select" ON order_watchers FOR SELECT USING (true);
CREATE POLICY "order_watchers_insert" ON order_watchers FOR INSERT WITH CHECK (true);
CREATE POLICY "order_watchers_delete" ON order_watchers FOR DELETE USING (true);

-- Artworks
CREATE POLICY "artworks_select" ON artworks FOR SELECT USING (true);
CREATE POLICY "artworks_insert" ON artworks FOR INSERT WITH CHECK (true);
CREATE POLICY "artworks_update" ON artworks FOR UPDATE USING (true);

-- Approval tokens (public access for validation)
CREATE POLICY "tokens_select" ON approval_tokens FOR SELECT USING (true);
CREATE POLICY "tokens_insert" ON approval_tokens FOR INSERT
  WITH CHECK (get_user_role() IN ('MASTER', 'GESTOR'));
CREATE POLICY "tokens_update" ON approval_tokens FOR UPDATE USING (true);

-- Comments
CREATE POLICY "comments_select" ON comments FOR SELECT USING (true);
CREATE POLICY "comments_insert" ON comments FOR INSERT WITH CHECK (true);
CREATE POLICY "comments_update" ON comments FOR UPDATE
  USING (user_id = auth.uid());

-- Checklists
CREATE POLICY "checklists_select" ON checklists FOR SELECT USING (true);
CREATE POLICY "checklists_insert" ON checklists FOR INSERT WITH CHECK (true);
CREATE POLICY "checklists_update" ON checklists FOR UPDATE USING (true);
CREATE POLICY "checklists_delete" ON checklists FOR DELETE USING (true);
CREATE POLICY "checklist_items_select" ON checklist_items FOR SELECT USING (true);
CREATE POLICY "checklist_items_insert" ON checklist_items FOR INSERT WITH CHECK (true);
CREATE POLICY "checklist_items_update" ON checklist_items FOR UPDATE USING (true);
CREATE POLICY "checklist_items_delete" ON checklist_items FOR DELETE USING (true);

-- Attachments
CREATE POLICY "attachments_select" ON attachments FOR SELECT USING (true);
CREATE POLICY "attachments_insert" ON attachments FOR INSERT WITH CHECK (true);
CREATE POLICY "attachments_delete" ON attachments FOR DELETE
  USING (uploaded_by = auth.uid() OR get_user_role() IN ('MASTER', 'GESTOR'));

-- Notifications (only own)
CREATE POLICY "notifications_select" ON notifications FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "notifications_insert" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "notifications_update" ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- Audit logs (MASTER only)
CREATE POLICY "audit_select" ON audit_logs FOR SELECT
  USING (get_user_role() = 'MASTER');
CREATE POLICY "audit_insert" ON audit_logs FOR INSERT WITH CHECK (true);

-- Public quotes
CREATE POLICY "quotes_select" ON public_quotes FOR SELECT
  USING (get_user_role() IN ('MASTER', 'GESTOR'));
CREATE POLICY "quotes_insert" ON public_quotes FOR INSERT WITH CHECK (true); -- public form
CREATE POLICY "quotes_update" ON public_quotes FOR UPDATE
  USING (get_user_role() IN ('MASTER', 'GESTOR'));

-- Order history
CREATE POLICY "history_select" ON order_history FOR SELECT USING (true);
CREATE POLICY "history_insert" ON order_history FOR INSERT WITH CHECK (true);

-- Sync logs
CREATE POLICY "sync_logs_select" ON tiny_sync_logs FOR SELECT
  USING (get_user_role() IN ('MASTER', 'GESTOR'));
CREATE POLICY "sync_logs_insert" ON tiny_sync_logs FOR INSERT WITH CHECK (true);

-- ============================================
-- ENABLE REALTIME
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_labels;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE comments;
