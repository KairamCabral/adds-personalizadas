-- Upsert no Storage substitui o arquivo e costuma exigir DELETE no objeto antigo.
-- Sem esta policy, o segundo upload do avatar pode falhar com erro de permissão.

DO $$
BEGIN
  CREATE POLICY "avatar_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'adds-crm'
    AND (storage.foldername(name))[1] = 'avatars'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
