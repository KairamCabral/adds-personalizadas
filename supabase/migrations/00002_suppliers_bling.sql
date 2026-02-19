-- ============================================
-- ADDS CRM — Migration 002: Suppliers + Bling Integration
-- ============================================

-- Fornecedores com integração Bling
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  bling_api_token TEXT,
  bling_base_url TEXT DEFAULT 'https://api.bling.com.br/Api/v3',
  shared_fields JSONB NOT NULL DEFAULT '{
    "client_name": true,
    "client_phone": true,
    "client_city": true,
    "client_state": true,
    "client_zip_code": true,
    "order_products": true,
    "order_quantities": true,
    "order_personalization": true,
    "order_due_date": true
  }'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT false,
  activated_at TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ,
  deactivation_reason TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Termos de uso assinados
CREATE TABLE supplier_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  token_expires_at TIMESTAMPTZ NOT NULL,
  signed_at TIMESTAMPTZ,
  signer_name TEXT,
  signer_role TEXT,
  signer_document TEXT,
  signer_ip INET,
  signer_user_agent TEXT,
  agreement_version TEXT NOT NULL DEFAULT '1.0',
  agreement_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES profiles(id),
  revocation_reason TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agreements_token ON supplier_agreements(token);
CREATE INDEX idx_agreements_supplier ON supplier_agreements(supplier_id);

-- Log de dados enviados ao fornecedor
CREATE TABLE supplier_data_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  order_id UUID NOT NULL REFERENCES orders(id),
  client_id UUID REFERENCES clients(id),
  data_sent JSONB NOT NULL,
  fields_sent TEXT[] NOT NULL,
  bling_contact_id BIGINT,
  bling_response JSONB,
  status TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  sent_by UUID REFERENCES profiles(id),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_data_logs_supplier ON supplier_data_logs(supplier_id);
CREATE INDEX idx_data_logs_order ON supplier_data_logs(order_id);

-- RLS
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_data_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "suppliers_admin" ON suppliers FOR ALL
  USING (get_user_role() IN ('MASTER', 'GESTOR'));

CREATE POLICY "agreements_admin" ON supplier_agreements FOR SELECT
  USING (get_user_role() IN ('MASTER', 'GESTOR'));
CREATE POLICY "agreements_insert" ON supplier_agreements FOR INSERT
  WITH CHECK (get_user_role() IN ('MASTER', 'GESTOR'));
CREATE POLICY "agreements_public_update" ON supplier_agreements FOR UPDATE
  USING (true);

CREATE POLICY "data_logs_admin" ON supplier_data_logs FOR ALL
  USING (get_user_role() IN ('MASTER', 'GESTOR'));

-- Trigger updated_at
CREATE TRIGGER trg_suppliers_updated BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Realtime para logs
ALTER PUBLICATION supabase_realtime ADD TABLE supplier_data_logs;
