-- Dashboard: Pedidos ativos / "Em andamento" = mesmo critério do badge do Pipeline (Kanban).
-- pedidos_crm inclui só is_pipeline_managed; mantém corte março/2026 OU status_changed.
-- Aplique no remoto se a migration 20260426100000 já tinha sido executada sem estes ajustes.

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

  -- CRITÉRIO CENTRAL: pedidos "reais" do CRM
  -- Incluir: criados após 01/03/2026 OU com histórico de mudança de status
  -- Mesmo universo do Kanban (getOrders): só pedidos geridos no pipeline
  pedidos_crm AS (
    SELECT o.id, o.created_at, o.status, o.due_date,
           o.archived_at, o.deleted_at, o.client_id,
           o.assigned_to, o.created_by, o.title
    FROM orders o
    WHERE o.deleted_at IS NULL
      AND o.is_pipeline_managed IS TRUE
      AND (
        o.created_at >= '2026-03-01'::timestamptz
        OR EXISTS (
          SELECT 1 FROM order_history oh
          WHERE oh.order_id = o.id
            AND oh.action = 'status_changed'
        )
      )
  ),

  -- Contagem idêntica ao badge "N pedidos" do Pipeline (sem filtro de período)
  pipeline_quadro AS (
    SELECT COUNT(*)::int AS total
    FROM orders o
    WHERE o.is_pipeline_managed IS TRUE
      AND o.deleted_at IS NULL
      AND o.archived_at IS NULL
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

      -- ATIVOS: igual ao total de cards no Pipeline (Kanban)
      (SELECT total FROM pipeline_quadro) AS pedidos_ativos,

      -- ATRASADOS: ativos com due_date passado
      (SELECT COUNT(*)::int FROM pedidos_crm o
       WHERE o.due_date IS NOT NULL
         AND o.due_date < CURRENT_DATE
         AND o.archived_at IS NULL
         AND o.status::text NOT IN ('FINALIZADO', 'ARQUIVADO')
         AND NOT EXISTS (SELECT 1 FROM pedido_com_cancelado c WHERE c.order_id = o.id)
      ) AS pedidos_atrasados,

      -- CRIADOS no período
      (SELECT COUNT(*)::int FROM pedidos_crm o
       WHERE o.created_at >= p_from AND o.created_at <= p_to) AS pedidos_criados,

      (SELECT COUNT(*)::int FROM pedidos_crm o, periodo p
       WHERE o.created_at >= p.prev_from AND o.created_at <= p.prev_to) AS pedidos_criados_prev,

      -- FINALIZADOS: transição para FINALIZADO no período
      (SELECT COUNT(DISTINCT oh.order_id)::int FROM order_history oh
       WHERE oh.action = 'status_changed'
         AND oh.new_value = 'FINALIZADO'
         AND oh.created_at >= p_from AND oh.created_at <= p_to
         AND oh.order_id IN (SELECT id FROM pedidos_crm)
      ) AS pedidos_finalizados,

      (SELECT COUNT(DISTINCT oh.order_id)::int FROM order_history oh, periodo p
       WHERE oh.action = 'status_changed'
         AND oh.new_value = 'FINALIZADO'
         AND oh.created_at >= p.prev_from AND oh.created_at <= p.prev_to
         AND oh.order_id IN (SELECT id FROM pedidos_crm)
      ) AS pedidos_finalizados_prev,

      -- CANCELADOS: tag PEDIDO_CANCELADO adicionada no período (sem archived_at)
      (SELECT COUNT(DISTINCT ol.order_id)::int FROM order_labels ol
       WHERE ol.label = 'PEDIDO_CANCELADO'::label_type
         AND ol.created_at >= p_from AND ol.created_at <= p_to
         AND ol.order_id IN (SELECT id FROM pedidos_crm WHERE archived_at IS NULL)
      ) AS pedidos_cancelados,

      -- ARQUIVADOS: archived_at no período (sem tag de cancelamento)
      (SELECT COUNT(*)::int FROM pedidos_crm o
       WHERE o.archived_at IS NOT NULL
         AND o.archived_at >= p_from AND o.archived_at <= p_to
         AND NOT EXISTS (SELECT 1 FROM pedido_com_cancelado c WHERE c.order_id = o.id)
      ) AS pedidos_arquivados,

      -- EXCLUÍDOS: deleted_at no período (pedidos do CRM, inclui sem histórico também)
      (SELECT COUNT(*)::int FROM orders o
       WHERE o.deleted_at IS NOT NULL
         AND o.deleted_at >= p_from AND o.deleted_at <= p_to
         AND o.is_pipeline_managed IS TRUE
         AND (
           o.created_at >= '2026-03-01'::timestamptz
           OR EXISTS (SELECT 1 FROM order_history oh
                      WHERE oh.order_id = o.id AND oh.action = 'status_changed')
         )
      ) AS pedidos_excluidos
  ),

  transicoes AS (
    SELECT
      oh.order_id,
      oh.old_value AS etapa,
      oh.created_at AS saiu_em,
      LAG(oh.created_at) OVER (PARTITION BY oh.order_id ORDER BY oh.created_at) AS entrou_por_transicao
    FROM order_history oh
    WHERE oh.action = 'status_changed'
      AND oh.created_at >= p_from AND oh.created_at <= p_to
      AND oh.order_id IN (SELECT id FROM pedidos_crm)
      AND oh.old_value IS NOT NULL
      AND oh.old_value NOT IN ('FATURADO', 'ARQUIVADO')  -- Excluir status legado
  ),

  transicoes_com_entrada AS (
    SELECT
      t.order_id,
      t.etapa,
      t.saiu_em,
      COALESCE(t.entrou_por_transicao, o.created_at) AS entrou_em
    FROM transicoes t
    JOIN pedidos_crm o ON o.id = t.order_id
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
      WHERE oh.action = 'status_changed'
        AND oh.new_value = 'FINALIZADO'
        AND oh.created_at >= p_from AND oh.created_at <= p_to
        AND oh.order_id IN (SELECT id FROM pedidos_crm)
      ORDER BY oh.order_id, oh.created_at ASC
    ) ff
    JOIN pedidos_crm o ON o.id = ff.order_id
  ),

  -- FUNIL: apenas pedidos CRM criados no período
  funil_entrada AS (
    SELECT DISTINCT o.id AS order_id
    FROM pedidos_crm o
    WHERE o.created_at >= p_from AND o.created_at <= p_to
  ),

  funil_concluidos AS (
    SELECT DISTINCT oh.order_id
    FROM order_history oh
    WHERE oh.action = 'status_changed'
      AND oh.new_value = 'FINALIZADO'
      AND oh.created_at >= p_from AND oh.created_at <= p_to
      AND oh.order_id IN (SELECT order_id FROM funil_entrada)
  ),

  funil_cancelados AS (
    SELECT DISTINCT ol.order_id
    FROM order_labels ol
    WHERE ol.label = 'PEDIDO_CANCELADO'::label_type
      AND ol.created_at >= p_from AND ol.created_at <= p_to
      AND ol.order_id IN (SELECT order_id FROM funil_entrada)
  ),

  funil AS (
    SELECT 'Entrada (criados)' AS etapa, (SELECT COUNT(*)::int FROM funil_entrada) AS quantidade, 1 AS ordem
    UNION ALL
    SELECT 'Concluídos', (SELECT COUNT(*)::int FROM funil_concluidos), 2
    UNION ALL
    SELECT 'Cancelados', (SELECT COUNT(*)::int FROM funil_cancelados), 3
    UNION ALL
    -- Mesmo número do card "Pedidos ativos" / badge do Pipeline (snapshot atual)
    SELECT 'Em andamento', (SELECT total FROM pipeline_quadro), 4
  ),

  funil_arr AS (
    SELECT COALESCE(json_agg(
      json_build_object('etapa', etapa, 'quantidade', quantidade, 'ordem', ordem)
      ORDER BY ordem
    ), '[]'::json) AS arr
    FROM funil
  ),

  -- STATUS: apenas pedidos CRM ativos
  por_status AS (
    SELECT
      o.status::text AS status,
      COUNT(*)::int AS quantidade
    FROM pedidos_crm o
    WHERE o.archived_at IS NULL
    GROUP BY o.status
  ),

  por_status_arr AS (
    SELECT COALESCE(json_agg(
      json_build_object('status', status, 'quantidade', quantidade)
    ), '[]'::json) AS arr
    FROM por_status
  ),

  -- TOP CLIENTES: apenas pedidos CRM no período
  top_clientes AS (
    SELECT
      c.id,
      c.name AS nome,
      c.company AS empresa,
      COUNT(o.id)::int AS totalpedidos
    FROM pedidos_crm o
    JOIN clients c ON c.id = o.client_id
    WHERE o.created_at >= p_from AND o.created_at <= p_to
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

  -- POR RESPONSÁVEL: apenas pedidos CRM ativos
  por_responsavel AS (
    SELECT
      COALESCE(
        NULLIF(TRIM(p.full_name), ''),
        INITCAP(SPLIT_PART(p.email, '@', 1)),
        'Sem responsável'
      ) AS nome,
      COUNT(*)::int AS quantidade
    FROM pedidos_crm o
    LEFT JOIN profiles p ON p.id = COALESCE(o.assigned_to, o.created_by)
    WHERE o.archived_at IS NULL
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

  -- TENDÊNCIA mensal (últimos 6 meses), apenas pedidos CRM
  meses AS (
    SELECT date_trunc('month', CURRENT_DATE - (n || ' months')::interval) AS mes
    FROM generate_series(0, 5) AS n
    ORDER BY mes
  ),

  tendencia AS (
    SELECT
      TO_CHAR(m.mes, 'YYYY-MM') AS mes,
      TO_CHAR(m.mes, 'TMMonth') AS mes_label,
      (SELECT COUNT(*)::int FROM pedidos_crm o
       WHERE o.created_at >= m.mes
         AND o.created_at < m.mes + INTERVAL '1 month') AS criados,
      (SELECT COUNT(DISTINCT oh.order_id)::int FROM order_history oh
       WHERE oh.action = 'status_changed'
         AND oh.new_value = 'FINALIZADO'
         AND oh.created_at >= m.mes
         AND oh.created_at < m.mes + INTERVAL '1 month'
         AND oh.order_id IN (SELECT id FROM pedidos_crm)) AS finalizados
    FROM meses m
  ),

  tendencia_arr AS (
    SELECT COALESCE(json_agg(
      json_build_object('mes', mes, 'mesLabel', mes_label, 'criados', criados, 'finalizados', finalizados)
      ORDER BY mes
    ), '[]'::json) AS arr
    FROM tendencia
  ),

  -- PARADOS: pedidos CRM ativos (não finalizados, não cancelados, não arquivados)
  -- - Atrasados: due_date < hoje
  -- - No prazo: due_date >= hoje (ou sem due_date)
  -- - Cancelados recentes: com tag PEDIDO_CANCELADO nos últimos 7 dias
  parados_ativos AS (
    SELECT
      o.id,
      o.title,
      o.status::text AS status,
      o.due_date,
      EXTRACT(DAY FROM (NOW() - COALESCE(
        (SELECT MAX(oh3.created_at) FROM order_history oh3
         WHERE oh3.order_id = o.id AND oh3.action = 'status_changed'),
        o.created_at
      )))::int AS dias_parado
    FROM pedidos_crm o
    WHERE o.archived_at IS NULL
      AND o.status::text NOT IN ('FINALIZADO', 'ARQUIVADO')
      AND NOT EXISTS (SELECT 1 FROM pedido_com_cancelado c WHERE c.order_id = o.id)
  ),

  parados_legacy AS (
    SELECT * FROM parados_ativos
    ORDER BY dias_parado DESC
    LIMIT 5
  ),

  parados_atrasados AS (
    SELECT * FROM parados_ativos
    WHERE due_date IS NOT NULL AND due_date < CURRENT_DATE
    ORDER BY dias_parado DESC
    LIMIT 5
  ),

  parados_no_prazo AS (
    SELECT * FROM parados_ativos
    WHERE due_date IS NULL OR due_date >= CURRENT_DATE
    ORDER BY dias_parado DESC
    LIMIT 5
  ),

  parados_cancelados_recentes AS (
    SELECT
      o.id,
      o.title,
      o.status::text AS status,
      ol.created_at AS cancelado_em,
      EXTRACT(DAY FROM (NOW() - ol.created_at))::int AS dias_desde_cancelamento
    FROM pedidos_crm o
    JOIN order_labels ol ON ol.order_id = o.id
    WHERE ol.label = 'PEDIDO_CANCELADO'::label_type
      AND ol.created_at >= NOW() - INTERVAL '7 days'
    ORDER BY ol.created_at DESC
    LIMIT 5
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
    'pedidosExcluidos', (SELECT pedidos_excluidos FROM kpis),
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
    'pedidosParados', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', id, 'title', title, 'status', status,
        'diasParado', dias_parado
      ) ORDER BY dias_parado DESC), '[]'::json) FROM parados_legacy
    ),
    'pedidosParadosAtrasados', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', id, 'title', title, 'status', status,
        'diasParado', dias_parado, 'dueDate', due_date
      ) ORDER BY dias_parado DESC), '[]'::json) FROM parados_atrasados
    ),
    'pedidosParadosNoPrazo', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', id, 'title', title, 'status', status,
        'diasParado', dias_parado, 'dueDate', due_date
      ) ORDER BY dias_parado DESC), '[]'::json) FROM parados_no_prazo
    ),
    'pedidosCanceladosRecentes', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', id, 'title', title, 'status', status,
        'canceladoEm', cancelado_em, 'diasDesdeCancelamento', dias_desde_cancelamento
      ) ORDER BY cancelado_em DESC), '[]'::json) FROM parados_cancelados_recentes
    )
  ) INTO result;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION get_dashboard_crm IS
'Dashboard CRM: pedidos reais (março+ ou status_changed) + geridos no pipeline; ativos/funil em andamento = total do Kanban; FATURADO excluído do tempo por etapa.';
