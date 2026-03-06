-- Policy para permitir que usuários deletem suas próprias notificações
CREATE POLICY "notifications_delete" ON notifications FOR DELETE
  USING (user_id = auth.uid());
