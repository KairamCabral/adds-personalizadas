-- Permite que usuários com papel MASTER excluam registros em public_quotes via cliente autenticado.
-- (Opcional se a app usar apenas DELETE /api/quotes/[id] com service role; mantém consistência RLS.)

CREATE POLICY "quotes_delete" ON public.public_quotes
  FOR DELETE
  USING (get_user_role() = 'MASTER');
