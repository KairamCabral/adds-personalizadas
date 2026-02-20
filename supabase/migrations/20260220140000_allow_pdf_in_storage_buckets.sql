-- Permitir PDF e vetores nos buckets de upload (logo e anexos)
-- Resolve: upload de PDF retornando 400 por allowed_mime_types restritivo

-- 1. Atualizar quote-logos (usado na API upload-logo ao criar pedido)
UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY[
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf', 'application/postscript', 'application/illustrator'
  ],
  file_size_limit = 10485760  -- 10MB
WHERE id = 'quote-logos';

-- 2. Criar ou atualizar bucket attachments (usado nos anexos do detalhe do pedido)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'attachments',
  'attachments',
  true,
  10485760,  -- 10MB
  ARRAY[
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf', 'application/postscript', 'application/illustrator'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  file_size_limit = EXCLUDED.file_size_limit;

-- Políticas para attachments (ignora se já existirem)
DO $$
BEGIN
  CREATE POLICY "Authenticated insert attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'attachments');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  CREATE POLICY "Authenticated read attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'attachments');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  CREATE POLICY "Authenticated delete attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'attachments');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
