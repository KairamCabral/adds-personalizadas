-- =====================================================================
-- find_client_by_document — determinístico + prefere o cadastro mais completo
--
-- APLICAÇÃO: manual, via Supabase Dashboard → SQL Editor, APÓS o merge do PR.
-- Idempotente (CREATE OR REPLACE). Sem BEGIN/COMMIT.
--
-- MOTIVO:
--   Há CPFs/CNPJs DUPLICADOS em `clients` (a coluna `document` não é única).
--   A versão anterior fazia `SELECT * ... LIMIT 1` SEM `ORDER BY`, retornando
--   uma linha NÃO-determinística. No módulo Congressos isso fazia o passo de
--   CPF mostrar um cliente e a gravação pegar OUTRA duplicata (às vezes SEM
--   e-mail), deixando a confirmação por e-mail sem ser enfileirada.
--   Agora a busca é estável e prioriza o cadastro mais completo.
--
-- IMPACTO MULTI-APP (banco compartilhado com adds-rep-app):
--   Função usada pelo formulário público /quote (web) e pelo lookup de CPF do
--   Congressos; pode ser usada pelo rep-app. A mudança é uma MELHORIA ESTRITA:
--   mesma assinatura, mesmo retorno (SETOF clients), mesmos grants/segurança;
--   apenas passa a devolver SEMPRE o cliente mais completo, de forma estável.
--   Nenhuma tabela, coluna, RLS ou grant é alterada.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.find_client_by_document(doc_digits text)
RETURNS SETOF public.clients
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT *
  FROM public.clients
  WHERE document IS NOT NULL
    AND document != ''
    AND regexp_replace(document, '\D', '', 'g') = doc_digits
  ORDER BY
    (tiny_id IS NOT NULL) DESC,   -- prefere o já sincronizado com o Tiny
    (email IS NOT NULL) DESC,     -- depois o que tem e-mail
    (phone IS NOT NULL) DESC,     -- depois o que tem telefone
    created_at DESC               -- por fim, o mais recente
  LIMIT 1;
$function$;
