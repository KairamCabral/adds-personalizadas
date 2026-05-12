-- Tabela local de depósitos do Tiny.
-- API Tiny v3 não expõe /depositos sem escopo OAuth especial, então mantemos
-- um cadastro local que o MASTER preenche uma vez. O ID corresponde ao ID
-- numérico do depósito no Tiny (visível na URL do Olist).

CREATE TABLE tiny_depositos (
  id BIGINT PRIMARY KEY,           -- ID numérico do Tiny (não é UUID)
  name TEXT NOT NULL,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tiny_depositos_active ON tiny_depositos(is_active)
  WHERE is_active = true;

CREATE TRIGGER trg_tiny_depositos_updated
  BEFORE UPDATE ON tiny_depositos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS: MASTER full, GESTOR read
ALTER TABLE tiny_depositos ENABLE ROW LEVEL SECURITY;

CREATE POLICY tiny_depositos_master_all ON tiny_depositos
  FOR ALL
  USING (get_user_role() = 'MASTER')
  WITH CHECK (get_user_role() = 'MASTER');

CREATE POLICY tiny_depositos_gestor_read ON tiny_depositos
  FOR SELECT
  USING (get_user_role() = 'GESTOR');

COMMENT ON TABLE tiny_depositos IS
  'Cadastro local de depósitos do Tiny. Preenchido manualmente porque a API /depositos não está exposta no escopo OAuth padrão.';
