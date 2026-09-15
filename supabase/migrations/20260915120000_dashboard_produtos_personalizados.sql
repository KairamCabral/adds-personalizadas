-- =====================================================================
-- Dashboard — Produtos personalizados por período
--
-- Responde "quantas unidades de cada produto personalizado entraram no
-- período" e "em quantos pedidos". Universo IDÊNTICO ao do get_dashboard_crm
-- (ver 20260426200000_dashboard_pedidos_ativos_igual_pipeline.sql):
-- pedidos geridos no pipeline, não excluídos, criados a partir de 01/03/2026
-- OU com histórico de mudança de status. Recorte: pedidos CRIADOS no período.
--
-- APLICAÇÃO: manual, via Supabase Dashboard → SQL Editor, APÓS o merge do PR.
-- SEM BEGIN/COMMIT (o SQL Editor não suporta transação explícita).
-- Idempotente: CREATE OR REPLACE.
--
-- IMPACTO MULTI-APP (banco compartilhado com adds-rep-app):
--   Nenhum. Duas funções novas, somente leitura (orders / order_items /
--   products). Nenhuma tabela, coluna, enum ou policy é alterada.
-- =====================================================================

-- 1) Helper de normalização de acentos ---------------------------------
-- Não depende da extensão `unaccent` (pode não estar habilitada no projeto).
-- Cobre os acentos usados em pt-BR. IMMUTABLE para poder entrar em JOIN.
CREATE OR REPLACE FUNCTION public.adds_unaccent(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT translate(
    COALESCE(p_text, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
  );
$$;

-- 2) Agregação por produto personalizado -------------------------------
CREATE OR REPLACE FUNCTION public.get_dashboard_produtos_personalizados(
  p_from timestamptz,
  p_to   timestamptz
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  WITH
  -- Mesmo critério central do get_dashboard_crm, já recortado pelo período.
  pedidos_crm AS (
    SELECT o.id
    FROM orders o
    WHERE o.deleted_at IS NULL
      AND o.is_pipeline_managed IS TRUE
      AND o.created_at >= p_from
      AND o.created_at <= p_to
      AND (
        o.created_at >= '2026-03-01'::timestamptz
        OR EXISTS (
          SELECT 1 FROM order_history oh
          WHERE oh.order_id = o.id
            AND oh.action = 'status_changed'
        )
      )
  ),

  -- Resolve o produto do item: por product_id e, quando nulo (itens importados
  -- do Tiny podem vir sem FK), por nome normalizado (sem acento, sem caixa).
  itens AS (
    SELECT
      oi.order_id,
      COALESCE(oi.quantity, 0)::bigint             AS quantidade,
      COALESCE(p.id, pn.id)                        AS produto_id,
      COALESCE(p.name, pn.name, oi.product_name)   AS produto_nome,
      COALESCE(p.product_type, pn.product_type)    AS produto_tipo
    FROM order_items oi
    JOIN pedidos_crm o ON o.id = oi.order_id
    LEFT JOIN products p
      ON p.id = oi.product_id
    LEFT JOIN products pn
      ON p.id IS NULL
     AND lower(btrim(adds_unaccent(pn.name)))
       = lower(btrim(adds_unaccent(oi.product_name)))
  ),

  personalizados AS (
    SELECT
      produto_id,
      produto_nome,
      SUM(quantidade)::int          AS unidades,
      COUNT(DISTINCT order_id)::int AS pedidos
    FROM itens
    WHERE produto_tipo = 'personalizado'
    GROUP BY produto_id, produto_nome
  ),

  -- Itens que não casaram com nenhum produto do catálogo. Vão como rodapé no
  -- card para os números não mentirem por omissão.
  nao_identificados AS (
    SELECT COALESCE(SUM(quantidade), 0)::int AS unidades
    FROM itens
    WHERE produto_id IS NULL
  )

  SELECT json_build_object(
    'produtos', COALESCE((
      SELECT json_agg(x ORDER BY x.unidades DESC, x.produto ASC)
      FROM (
        SELECT
          produto_id   AS "produtoId",
          produto_nome AS produto,
          unidades,
          pedidos
        FROM personalizados
      ) x
    ), '[]'::json),
    'totalUnidades', COALESCE((SELECT SUM(unidades)::int FROM personalizados), 0),
    'totalPedidos',  COALESCE((
      SELECT COUNT(DISTINCT order_id)::int
      FROM itens
      WHERE produto_tipo = 'personalizado'
    ), 0),
    'naoIdentificados', (SELECT unidades FROM nao_identificados)
  ) INTO result;

  RETURN result;
END $$;

GRANT EXECUTE ON FUNCTION public.adds_unaccent(text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_dashboard_produtos_personalizados(timestamptz, timestamptz)
  TO authenticated, service_role;
