-- Permite PRESTADOR marcar comentários como lidos.
--
-- Antes: policy comments_update_mark_read aceitava autor + MASTER + GESTOR +
-- assigned_to + watcher. Quando um PRESTADOR (que não é autor nem assigned
-- nem watcher) tentava marcar um comentário como lido, o UPDATE silenciava.
--
-- Agora: PRESTADOR entra na lista de roles permitidas, ao lado de MASTER e
-- GESTOR. PRESTADOR continua sem poder atualizar o conteúdo do comentário
-- (essa permissão é da policy comments_update, que segue restrita ao autor).

BEGIN;

DROP POLICY IF EXISTS comments_update_mark_read ON comments;

CREATE POLICY comments_update_mark_read ON comments
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM orders o
      WHERE o.id = comments.order_id
        AND (
          (SELECT role FROM profiles WHERE id = auth.uid())
            = ANY (ARRAY['MASTER'::user_role, 'GESTOR'::user_role, 'PRESTADOR'::user_role])
          OR o.assigned_to = auth.uid()
          OR EXISTS (
            SELECT 1 FROM order_watchers ow
            WHERE ow.order_id = o.id AND ow.user_id = auth.uid()
          )
        )
    )
  );

COMMIT;
