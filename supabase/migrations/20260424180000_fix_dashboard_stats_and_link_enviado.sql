-- Dashboard CRM: alinhamento com regras de negócio (24/04/2026)
-- - Inclui todos os pedidos (com ou sem Tiny)
-- - Ativos: exceto FINALIZADO, ARQUIVADO, deletado, tag PEDIDO_CANCELADO
-- - Finalizados no KPI: transição para FINALIZADO apenas
-- - Cancelados: arquivado, deletado ou etiqueta PEDIDO_CANCELADO no período
-- - Funil: LINK_ENVIADO em Aprovação; CLIENTES sem coluna deleted_at (schema atual)
CREATE OR REPLACE FUNCTION get_dashboard_crm(p_from timestamptz, p_to timestamptz)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  WITH
  periodo AS (
    SELECT
      p_from AS current_from,
      p_to AS current_to,
      p_from - (p_to - p_from) AS prev_from,
      p_from AS prev_to
  ),

  pedido_com_cancelado AS (
    SELECT DISTINCT order_id
    FROM order_labels
    WHERE label = 'PEDIDO_CANCELADO'::label_type
  ),

  kpis AS (
    SELECT
      (SELECT COUNT(*)::int FROM clients) AS total_clientes,
      (SELECT COUNT(*)::int FROM clients
       WHERE created_at >= p_from AND created_at <= p_to) AS novos_clientes,
      (SELECT COUNT(*)::int FROM clients c, periodo p
       WHERE c.created_at >= p.prev_from AND c.created_at <= p.prev_to) AS novos_clientes_prev,
      (SELECT COUNT(*)::int FROM orders o
       WHERE o.archived_at IS NULL
         AND o.deleted_at IS NULL
         AND o.status::text NOT IN ('FINALIZADO', 'ARQUIVADO')
         AND NOT EXISTS (SELECT 1 FROM pedido_com_cancelado c WHERE c.order_id = o.id)
      ) AS pedidos_ativos,
      (SELECT COUNT(*)::int FROM orders o
       WHERE o.due_date IS NOT NULL
         AND o.due_date < CURRENT_DATE
         AND o.archived_at IS NULL
         AND o.deleted_at IS NULL
         AND o.status::text NOT IN ('FINALIZADO', 'ARQUIVADO')
         AND NOT EXISTS (SELECT 1 FROM pedido_com_cancelado c WHERE c.order_id = o.id)
      ) AS pedidos_atrasados,
      (SELECT COUNT(*)::int FROM orders o
       WHERE o.deleted_at IS NULL
         AND o.created_at >= p_from AND o.created_at <= p_to) AS pedidos_criados,
      (SELECT COUNT(*)::int FROM orders o, periodo p
       WHERE o.deleted_at IS NULL
         AND o.created_at >= p.prev_from AND o.created_at <= p.prev_to) AS pedidos_criados_prev,
      (SELECT COUNT(DISTINCT oh.order_id)::int FROM order_history oh
       JOIN orders o ON o.id = oh.order_id
       WHERE oh.action = 'status_changed'
         AND oh.new_value = 'FINALIZADO'
         AND oh.created_at >= p_from AND oh.created_at <= p_to
         AND o.deleted_at IS NULL) AS pedidos_finalizados,
      (SELECT COUNT(DISTINCT oh.order_id)::int FROM order_history oh
       JOIN orders o ON o.id = oh.order_id, periodo p
       WHERE oh.action = 'status_changed'
         AND oh.new_value = 'FINALIZADO'
         AND oh.created_at >= p.prev_from AND oh.created_at <= p.prev_to
         AND o.deleted_at IS NULL) AS pedidos_finalizados_prev,
      (SELECT COUNT(DISTINCT o.id)::int FROM orders o
       WHERE
         (o.archived_at IS NOT NULL AND o.archived_at >= p_from AND o.archived_at <= p_to)
         OR (o.deleted_at IS NOT NULL AND o.deleted_at >= p_from AND o.deleted_at <= p_to)
         OR EXISTS (
           SELECT 1 FROM order_labels ol
           WHERE ol.order_id = o.id
             AND ol.label = 'PEDIDO_CANCELADO'::label_type
             AND ol.created_at >= p_from AND ol.created_at <= p_to
         )
      ) AS pedidos_cancelados,
      (SELECT COUNT(*)::int FROM orders o
       WHERE o.archived_at IS NOT NULL
         AND o.archived_at >= p_from AND o.archived_at <= p_to
         AND o.deleted_at IS NULL) AS pedidos_arquivados
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
      AND o.deleted_at IS NULL
      AND oh.created_at >= p_from AND oh.created_at <= p_to
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
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (saiu_em - entrou_em)) / 3600)::numeric(10,1) AS mediana_horas,
      MIN(EXTRACT(EPOCH FROM (saiu_em - entrou_em)) / 3600)::numeric(10,1) AS min_horas,
      MAX(EXTRACT(EPOCH FROM (saiu_em - entrou_em)) / 3600)::numeric(10,1) AS max_horas,
      COUNT(*)::int AS pedidos
    FROM transicoes_com_entrada
    WHERE EXTRACT(EPOCH FROM (saiu_em - entrou_em)) > 0
    GROUP BY etapa
  ),
  tempo_etapa_arr AS (
    SELECT COALESCE(json_agg(
      json_build_object(
        'etapa', etapa,
        'mediaHoras', media_horas,
        'medianaHoras', mediana_horas,
        'minHoras', min_horas,
        'maxHoras', max_horas,
        'pedidos', pedidos,
        'isBottleneck', (media_horas = (SELECT MAX(media_horas) FROM tempo_por_etapa))
      )
      ORDER BY media_horas DESC
    ), '[]'::json) AS arr
    FROM tempo_por_etapa
  ),

  tempo_total AS (
    SELECT
      AVG(EXTRACT(EPOCH FROM (ff.created_at - o.created_at)) / 3600)::numeric(10,1) AS media_horas,
      COUNT(*)::int AS pedidos
    FROM (
      SELECT DISTINCT ON (oh.order_id) oh.order_id, oh.created_at
      FROM order_history oh
      JOIN orders o ON o.id = oh.order_id
      WHERE oh.action = 'status_changed'
        AND oh.new_value = 'FINALIZADO'
        AND oh.created_at >= p_from AND oh.created_at <= p_to
        AND o.deleted_at IS NULL
      ORDER BY oh.order_id, oh.created_at ASC
    ) ff
    JOIN orders o ON o.id = ff.order_id
  ),

  funil_etapas AS (
    SELECT
      CASE
        WHEN oh.new_value IN ('AUTOMATICO', 'FAZER', 'AJUSTE') THEN 'Entrada'
        WHEN oh.new_value IN (
          'APROVACAO', 'LINK_ENVIADO', 'AGUARDANDO_APROVACAO',
          'APROVADO', 'ARTE_APROVADA', 'CONFIRMACAO'
        ) THEN 'Aprovação'
        WHEN oh.new_value = 'PRODUCAO' THEN 'Produção'
        WHEN oh.new_value = 'EXPEDICAO' THEN 'Expedição'
        WHEN oh.new_value IN ('FINALIZADO', 'ENTREGUE', 'FATURADO') THEN 'Finalizado'
        ELSE NULL
      END AS etapa_grupo,
      oh.order_id
    FROM order_history oh
    JOIN orders o ON o.id = oh.order_id
    WHERE oh.action = 'status_changed'
      AND oh.created_at >= p_from AND oh.created_at <= p_to
      AND o.deleted_at IS NULL

    UNION ALL

    SELECT 'Entrada', o.id
    FROM orders o
    WHERE o.deleted_at IS NULL
      AND o.created_at >= p_from AND o.created_at <= p_to
  ),
  funil AS (
    SELECT
      etapa_grupo AS etapa,
      COUNT(DISTINCT order_id)::int AS quantidade,
      CASE etapa_grupo
        WHEN 'Entrada' THEN 1
        WHEN 'Aprovação' THEN 2
        WHEN 'Produção' THEN 3
        WHEN 'Expedição' THEN 4
        WHEN 'Finalizado' THEN 5
      END AS ordem
    FROM funil_etapas
    WHERE etapa_grupo IS NOT NULL
    GROUP BY etapa_grupo
  ),
  funil_arr AS (
    SELECT COALESCE(json_agg(
      json_build_object(
        'etapa', etapa,
        'quantidade', quantidade,
        'ordem', ordem
      )
      ORDER BY ordem
    ), '[]'::json) AS arr
    FROM funil
  ),

  por_status AS (
    SELECT
      o.status::text AS status,
      COUNT(*)::int AS quantidade
    FROM orders o
    WHERE o.deleted_at IS NULL
      AND o.archived_at IS NULL
    GROUP BY o.status
  ),
  por_status_arr AS (
    SELECT COALESCE(json_agg(
      json_build_object('status', status, 'quantidade', quantidade)
    ), '[]'::json) AS arr
    FROM por_status
  ),

  top_clientes AS (
    SELECT
      c.id,
      c.name AS nome,
      c.company AS empresa,
      COUNT(o.id)::int AS totalpedidos
    FROM orders o
    JOIN clients c ON c.id = o.client_id
    WHERE o.deleted_at IS NULL
      AND o.created_at >= p_from AND o.created_at <= p_to
    GROUP BY c.id, c.name, c.company
    ORDER BY COUNT(o.id) DESC
    LIMIT 10
  ),
  top_clientes_arr AS (
    SELECT COALESCE(json_agg(
      json_build_object('id', id, 'nome', nome, 'empresa', empresa, 'totalPedidos', totalpedidos)
      ORDER BY totalpedidos DESC
    ), '[]'::json) AS arr
    FROM top_clientes
  ),

  por_responsavel AS (
    SELECT
      COALESCE(
        NULLIF(TRIM(p.full_name), ''),
        INITCAP(SPLIT_PART(p.email, '@', 1)),
        'Sem responsável'
      ) AS nome,
      COUNT(*)::int AS quantidade
    FROM orders o
    LEFT JOIN profiles p ON p.id = COALESCE(o.assigned_to, o.created_by)
    WHERE o.deleted_at IS NULL
      AND o.archived_at IS NULL
    GROUP BY COALESCE(
      NULLIF(TRIM(p.full_name), ''),
      INITCAP(SPLIT_PART(p.email, '@', 1)),
      'Sem responsável'
    )
    ORDER BY quantidade DESC
  ),
  por_responsavel_arr AS (
    SELECT COALESCE(json_agg(
      json_build_object('nome', nome, 'quantidade', quantidade)
      ORDER BY quantidade DESC
    ), '[]'::json) AS arr
    FROM por_responsavel
  ),

  meses AS (
    SELECT date_trunc('month', CURRENT_DATE - (n || ' months')::interval) AS mes
    FROM generate_series(0, 5) AS n
    ORDER BY mes
  ),
  tendencia AS (
    SELECT
      TO_CHAR(m.mes, 'YYYY-MM') AS mes,
      TO_CHAR(m.mes, 'TMMonth') AS mes_label,
      (SELECT COUNT(*)::int FROM orders o
       WHERE o.deleted_at IS NULL
         AND o.created_at >= m.mes
         AND o.created_at < m.mes + INTERVAL '1 month') AS criados,
      (SELECT COUNT(DISTINCT oh.order_id)::int FROM order_history oh
       JOIN orders o ON o.id = oh.order_id
       WHERE oh.action = 'status_changed'
         AND oh.new_value = 'FINALIZADO'
         AND oh.created_at >= m.mes
         AND oh.created_at < m.mes + INTERVAL '1 month'
         AND o.deleted_at IS NULL) AS finalizados
    FROM meses m
  ),
  tendencia_arr AS (
    SELECT COALESCE(json_agg(
      json_build_object('mes', mes, 'mesLabel', mes_label, 'criados', criados, 'finalizados', finalizados)
      ORDER BY mes
    ), '[]'::json) AS arr
    FROM tendencia
  ),

  parados AS (
    SELECT
      o.id,
      o.title,
      o.status::text AS status,
      EXTRACT(DAY FROM (NOW() - COALESCE(
        (SELECT MAX(oh3.created_at) FROM order_history oh3
         WHERE oh3.order_id = o.id AND oh3.action = 'status_changed'),
        o.created_at
      )))::int AS dias_parado
    FROM orders o
    WHERE o.deleted_at IS NULL
      AND o.archived_at IS NULL
      AND o.status::text NOT IN ('FINALIZADO', 'ARQUIVADO')
      AND NOT EXISTS (SELECT 1 FROM pedido_com_cancelado c WHERE c.order_id = o.id)
    ORDER BY dias_parado DESC
    LIMIT 5
  ),
  parados_arr AS (
    SELECT COALESCE(json_agg(
      json_build_object(
        'id', id,
        'title', title,
        'status', status,
        'diasParado', dias_parado
      )
      ORDER BY dias_parado DESC
    ), '[]'::json) AS arr
    FROM parados
  )

  SELECT json_build_object(
    'totalClientes', (SELECT total_clientes FROM kpis),
    'novosClientes', (SELECT novos_clientes FROM kpis),
    'novosClientesPrev', (SELECT novos_clientes_prev FROM kpis),
    'pedidosAtivos', (SELECT pedidos_ativos FROM kpis),
    'pedidosAtrasados', (SELECT pedidos_atrasados FROM kpis),
    'pedidosCriados', (SELECT pedidos_criados FROM kpis),
    'pedidosCriadosPrev', (SELECT pedidos_criados_prev FROM kpis),
    'pedidosFinalizados', (SELECT pedidos_finalizados FROM kpis),
    'pedidosFinalizadosPrev', (SELECT pedidos_finalizados_prev FROM kpis),
    'pedidosCancelados', (SELECT pedidos_cancelados FROM kpis),
    'pedidosArquivados', (SELECT pedidos_arquivados FROM kpis),
    'taxaConclusao', CASE
      WHEN (SELECT pedidos_criados FROM kpis) > 0
      THEN ROUND(((SELECT pedidos_finalizados FROM kpis)::numeric / (SELECT pedidos_criados FROM kpis)) * 100, 1)
      ELSE 0
    END,
    'tempoMedioTotal', json_build_object(
      'mediaHoras', COALESCE((SELECT media_horas FROM tempo_total), 0),
      'pedidos', COALESCE((SELECT pedidos FROM tempo_total), 0)
    ),
    'tempoPorEtapa', (SELECT arr FROM tempo_etapa_arr),
    'funil', (SELECT arr FROM funil_arr),
    'porStatus', (SELECT arr FROM por_status_arr),
    'topClientes', (SELECT arr FROM top_clientes_arr),
    'porResponsavel', (SELECT arr FROM por_responsavel_arr),
    'tendencia', (SELECT arr FROM tendencia_arr),
    'pedidosParados', (SELECT arr FROM parados_arr)
  ) INTO result;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION get_dashboard_crm IS
'Dashboard CRM: regras 24/04/2026 — sem filtro tiny_order_id; ativos; finalizados=FINALIZADO; cancelados; funil com LINK_ENVIADO.';
