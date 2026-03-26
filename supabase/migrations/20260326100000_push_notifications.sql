-- Tabela de tokens de push (Expo)
CREATE TABLE push_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token       TEXT        NOT NULL,
  platform    TEXT        CHECK (platform IN ('ios', 'android', 'web')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, token)
);

CREATE INDEX idx_push_tokens_user ON push_tokens(user_id);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Usuário pode gerenciar apenas seus próprios tokens
CREATE POLICY "push_tokens_select" ON push_tokens FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "push_tokens_insert" ON push_tokens FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "push_tokens_update" ON push_tokens FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "push_tokens_delete" ON push_tokens FOR DELETE USING (user_id = auth.uid());

-- Coluna para controlar se o push já foi enviado para cada notificação
ALTER TABLE notifications ADD COLUMN push_sent BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_notifications_push_pending ON notifications(user_id) WHERE push_sent = false;
