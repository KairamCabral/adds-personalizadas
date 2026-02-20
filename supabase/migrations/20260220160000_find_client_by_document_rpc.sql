-- RPC para buscar cliente por CPF/CNPJ (apenas dígitos).
-- Usado por /api/clients/find-by-document no fluxo de orçamento e outros.
CREATE OR REPLACE FUNCTION find_client_by_document(doc_digits text)
RETURNS SETOF clients
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT *
  FROM clients
  WHERE document IS NOT NULL
    AND regexp_replace(document, '[^0-9]', '', 'g') = doc_digits
  LIMIT 1;
$$;
