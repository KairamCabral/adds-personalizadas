-- Atualiza shared_fields: remove client_phone, adiciona document e endereço completo
-- Email e telefone NÃO são enviados ao fornecedor (LGPD)

ALTER TABLE suppliers
  ALTER COLUMN shared_fields SET DEFAULT '{
    "client_name": true,
    "client_document": true,
    "client_street": true,
    "client_number": true,
    "client_complement": true,
    "client_neighborhood": true,
    "client_city": true,
    "client_state": true,
    "client_zip_code": true,
    "order_products": true,
    "order_quantities": true,
    "order_personalization": true,
    "order_due_date": true
  }'::jsonb;

-- Migra fornecedores existentes: remove client_phone e adiciona novos campos
UPDATE suppliers
SET shared_fields = (shared_fields - 'client_phone')
  || jsonb_build_object(
    'client_document', COALESCE((shared_fields->>'client_document')::boolean, true),
    'client_street', COALESCE((shared_fields->>'client_street')::boolean, true),
    'client_number', COALESCE((shared_fields->>'client_number')::boolean, true),
    'client_complement', COALESCE((shared_fields->>'client_complement')::boolean, true),
    'client_neighborhood', COALESCE((shared_fields->>'client_neighborhood')::boolean, true)
  );
