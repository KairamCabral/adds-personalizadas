-- Dashboard CRM unificado: uma RPC que retorna todas as métricas estratégicas
CREATE OR REPLACE FUNCTION get_dashboard_crm(p_from timestamptz, p_to timestamptz)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := CURRENT_DATE;
  v_result json;
  v_finished text[] := ARRAY['FINALIZADO','ENTREGUE','FATURADO'];
  v_active text[] := ARRAY['FAZER','AJUSTE','APROVACAO','APROVADO','ARTE_APROVADA','PRODUCAO','EXPEDICAO'];
BEGIN

WITH
clientes AS (
  SELECT
    COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE created_at >= p_from AND created_at <= p_to)::int AS novos
  FROM clients
  WHERE tiny_id IS NULL
),

pipeline AS (
  SELECT
    COUNT(*)::int AS ativos,
    COUNT(*) FILTER (WHERE due_date < v_today AND status::text = ANY(v_active))::int AS atrasados
  FROM orders
  WHERE tiny_order_id IS NULL AND archived_at IS NULL
),

criados AS (
  SELECT COUNT(*)::int AS total
  FROM orders
  WHERE tiny_order_id IS NULL
    AND archived_at IS NULL
    AND created_at >= p_from AND created_at <= p_to
),

finalizados_ids AS (
  SELECT DISTINCT oh.order_id
  FROM order_history oh
  JOIN orders o ON o.id = oh.order_id
  WHERE oh.action = 'status_changed'
    AND oh.new_value = ANY(v_finished)
    AND oh.created_at >= p_from AND oh.created_at <= p_to
    AND o.tiny_order_id IS NULL
),
finalizados AS (
  SELECT COUNT(*)::int AS total FROM finalizados_ids
),

arquivados AS (
  SELECT COUNT(*)::int AS total
  FROM orders
  WHERE tiny_order_id IS NULL
    AND archived_at IS NOT NULL
    AND archived_at >= p_from AND archived_at <= p_to
),

tempo_total AS (
  SELECT
    AVG(EXTRACT(EPOCH FROM (oh.created_at - o.created_at)) / 3600)::numeric(10,1) AS media_horas,
    COUNT(*)::int AS pedidos
  FROM (
    SELECT DISTINCT ON (oh.order_id) oh.order_id, oh.created_at
    FROM order_history oh
    JOIN orders o ON o.id = oh.order_id
    WHERE oh.action = 'status_changed'
      AND oh.new_value = ANY(v_finished)
      AND oh.created_at >= p_from AND oh.created_at <= p_to
      AND o.tiny_order_id IS NULL
    ORDER BY oh.order_id, oh.created_at ASC
  ) oh
  JOIN orders o ON o.id = oh.order_id
),

transicoes AS (
  SELECT
    oh.order_id,
    oh.old_value AS etapa,
    oh.created_at AS saiu_em,
    LAG(oh.created_at) OVER (PARTITION BY oh.order_id ORDER BY oh.created_at) AS entrou_por_transicao
  FROM order_history oh
  JOIN orders o ON o.id = oh.order_id
  WHERE oh.action = 'status_changed'
    AND o.tiny_order_id IS NULL
),
transicoes_com_entrada AS (
  SELECT
    t.order_id,
    t.etapa,
    t.saiu_em,
    COALESCE(t.entrou_por_transicao, o.created_at) AS entrou_em
  FROM transicoes t
  JOIN orders o ON o.id = t.order_id
),
tempo_por_etapa AS (
  SELECT
    etapa,
    AVG(EXTRACT(EPOCH FROM (saiu_em - entrou_em)) / 3600)::numeric(10,1) AS media_horas,
    COUNT(*)::int AS pedidos
  FROM transicoes_com_entrada
  WHERE EXTRACT(EPOCH FROM (saiu_em - entrou_em)) > 0
  GROUP BY etapa
),
tempo_etapa_arr AS (
  SELECT json_agg(
    json_build_object(
      'etapa', etapa,
      'mediaHoras', media_horas,
      'pedidos', pedidos,
      'isBottleneck', (media_horas = (SELECT MAX(media_horas) FROM tempo_por_etapa))
    )
    ORDER BY media_horas DESC
  ) AS arr
  FROM tempo_por_etapa
),

funil AS (
  SELECT
    COUNT(*) FILTER (WHERE status::text IN ('FAZER','AJUSTE','APROVACAO','APROVADO','ARTE_APROVADA'))::int AS fazer_aprovacao,
    COUNT(*) FILTER (WHERE status::text = 'PRODUCAO')::int AS producao,
    COUNT(*) FILTER (WHERE status::text = 'EXPEDICAO')::int AS expedicao,
    COUNT(*) FILTER (WHERE status::text = ANY(v_finished))::int AS finalizado
  FROM orders
  WHERE tiny_order_id IS NULL AND archived_at IS NULL
),

por_status AS (
  SELECT json_agg(json_build_object('status', status, 'quantidade', qtd) ORDER BY qtd DESC) AS arr
  FROM (
    SELECT status::text AS status, COUNT(*)::int AS qtd
    FROM orders
    WHERE tiny_order_id IS NULL AND archived_at IS NULL
    GROUP BY status
  ) s
),

por_responsavel AS (
  SELECT json_agg(json_build_object('nome', nome, 'quantidade', qtd) ORDER BY qtd DESC) AS arr
  FROM (
    SELECT COALESCE(p.full_name, 'Sem responsável') AS nome, COUNT(*)::int AS qtd
    FROM orders o
    LEFT JOIN profiles p ON p.id = o.assigned_to
    WHERE o.tiny_order_id IS NULL AND o.archived_at IS NULL
    GROUP BY COALESCE(p.full_name, 'Sem responsável')
  ) r
),

top_clientes AS (
  SELECT json_agg(json_build_object('id', id, 'nome', nome, 'empresa', empresa, 'totalPedidos', tp) ORDER BY tp DESC) AS arr
  FROM (
    SELECT c.id, c.name AS nome, c.company AS empresa, COUNT(o.id)::int AS tp
    FROM clients c
    JOIN orders o ON o.client_id = c.id
    WHERE o.tiny_order_id IS NULL
      AND o.created_at >= p_from AND o.created_at <= p_to
    GROUP BY c.id, c.name, c.company
    ORDER BY COUNT(o.id) DESC
    LIMIT 10
  ) t
)

SELECT json_build_object(
  'totalClientes', (SELECT total FROM clientes),
  'novosClientes', (SELECT novos FROM clientes),
  'pedidosAtivos', (SELECT ativos FROM pipeline),
  'pedidosAtrasados', (SELECT atrasados FROM pipeline),
  'pedidosCriados', (SELECT total FROM criados),
  'pedidosFinalizados', (SELECT total FROM finalizados),
  'pedidosArquivados', (SELECT total FROM arquivados),
  'taxaConclusao', CASE WHEN (SELECT total FROM criados) > 0
    THEN ROUND(((SELECT total FROM finalizados)::numeric / (SELECT total FROM criados)) * 100, 1)
    ELSE 0 END,
  'tempoMedioTotal', json_build_object(
    'mediaHoras', COALESCE((SELECT media_horas FROM tempo_total), 0),
    'pedidos', COALESCE((SELECT pedidos FROM tempo_total), 0)
  ),
  'tempoPorEtapa', COALESCE((SELECT arr FROM tempo_etapa_arr), '[]'::json),
  'funil', json_build_object(
    'fazerAprovacao', (SELECT fazer_aprovacao FROM funil),
    'producao', (SELECT producao FROM funil),
    'expedicao', (SELECT expedicao FROM funil),
    'finalizado', (SELECT finalizado FROM funil)
  ),
  'porStatus', COALESCE((SELECT arr FROM por_status), '[]'::json),
  'porResponsavel', COALESCE((SELECT arr FROM por_responsavel), '[]'::json),
  'topClientes', COALESCE((SELECT arr FROM top_clientes), '[]'::json)
) INTO v_result;

RETURN v_result;
END;
$$;
