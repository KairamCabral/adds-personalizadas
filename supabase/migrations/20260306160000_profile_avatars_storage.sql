-- Storage bucket e policies para avatares de perfil
-- Bucket adds-crm (se não existir) com pasta avatars/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'adds-crm',
  'adds-crm',
  true,
  2097152,  -- 2MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  file_size_limit = GREATEST(storage.buckets.file_size_limit, EXCLUDED.file_size_limit);

-- Usuário autenticado pode fazer upload do próprio avatar: avatars/{user_id}/avatar.*
DO $$
BEGIN
  CREATE POLICY "avatar_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'adds-crm'
    AND (storage.foldername(name))[1] = 'avatars'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Usuário pode atualizar (upsert) o próprio avatar
DO $$
BEGIN
  CREATE POLICY "avatar_update_own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'adds-crm'
    AND (storage.foldername(name))[1] = 'avatars'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Leitura pública para avatares (bucket público)
DO $$
BEGIN
  CREATE POLICY "avatar_select_public"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'adds-crm');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
