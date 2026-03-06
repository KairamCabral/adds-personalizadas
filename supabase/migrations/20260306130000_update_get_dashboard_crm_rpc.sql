-- Dashboard CRM v2: tempo por etapa filtrado por período, funil real, tendência, pedidos parados
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
  -- ═══════════════════════════════════════════
  -- PERÍODO ANTERIOR (para comparação)
  -- ═══════════════════════════════════════════
  periodo AS (
    SELECT
      p_from AS current_from,
      p_to AS current_to,
      p_from - (p_to - p_from) AS prev_from,
      p_from AS prev_to
  ),

  -- ═══════════════════════════════════════════
  -- KPIs BÁSICOS
  -- ═══════════════════════════════════════════
  kpis AS (
    SELECT
      (SELECT COUNT(*) FROM clients WHERE tiny_id IS NULL)::int AS total_clientes,
      (SELECT COUNT(*) FROM clients
       WHERE tiny_id IS NULL AND created_at BETWEEN p_from AND p_to)::int AS novos_clientes,
      (SELECT COUNT(*) FROM clients c, periodo p
       WHERE c.tiny_id IS NULL AND c.created_at BETWEEN p.prev_from AND p.prev_to)::int AS novos_clientes_prev,
      (SELECT COUNT(*) FROM orders
       WHERE tiny_order_id IS NULL AND archived_at IS NULL
       AND status::text NOT IN ('FINALIZADO', 'ENTREGUE', 'FATURADO'))::int AS pedidos_ativos,
      (SELECT COUNT(*) FROM orders
       WHERE tiny_order_id IS NULL AND archived_at IS NULL
       AND due_date < CURRENT_DATE
       AND status::text NOT IN ('FINALIZADO', 'ENTREGUE', 'FATURADO'))::int AS pedidos_atrasados,
      (SELECT COUNT(*) FROM orders
       WHERE tiny_order_id IS NULL AND created_at BETWEEN p_from AND p_to)::int AS pedidos_criados,
      (SELECT COUNT(*) FROM orders o, periodo p
       WHERE o.tiny_order_id IS NULL AND o.created_at BETWEEN p.prev_from AND p.prev_to)::int AS pedidos_criados_prev,
      (SELECT COUNT(DISTINCT oh.order_id) FROM order_history oh
       JOIN orders o ON o.id = oh.order_id
       WHERE oh.action = 'status_changed'
       AND oh.new_value IN ('FINALIZADO', 'ENTREGUE', 'FATURADO')
       AND oh.created_at BETWEEN p_from AND p_to
       AND o.tiny_order_id IS NULL)::int AS pedidos_finalizados,
      (SELECT COUNT(DISTINCT oh.order_id) FROM order_history oh
       JOIN orders o ON o.id = oh.order_id, periodo p
       WHERE oh.action = 'status_changed'
       AND oh.new_value IN ('FINALIZADO', 'ENTREGUE', 'FATURADO')
       AND oh.created_at BETWEEN p.prev_from AND p.prev_to
       AND o.tiny_order_id IS NULL)::int AS pedidos_finalizados_prev,
      (SELECT COUNT(*) FROM orders
       WHERE tiny_order_id IS NULL AND archived_at IS NOT NULL
       AND archived_at BETWEEN p_from AND p_to)::int AS pedidos_arquivados
  ),

  -- ═══════════════════════════════════════════
  -- TEMPO MÉDIO POR ETAPA (FILTRADO POR PERÍODO)
  -- ═══════════════════════════════════════════
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
      AND oh.created_at BETWEEN p_from AND p_to
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

  -- ═══════════════════════════════════════════
  -- TEMPO MÉDIO TOTAL (criação → finalização)
  -- ═══════════════════════════════════════════
  tempo_total AS (
    SELECT
      AVG(EXTRACT(EPOCH FROM (ff.created_at - o.created_at)) / 3600)::numeric(10,1) AS media_horas,
      COUNT(*)::int AS pedidos
    FROM (
      SELECT DISTINCT ON (oh.order_id) oh.order_id, oh.created_at
      FROM order_history oh
      JOIN orders o ON o.id = oh.order_id
      WHERE oh.action = 'status_changed'
        AND oh.new_value IN ('FINALIZADO', 'ENTREGUE', 'FATURADO')
        AND oh.created_at BETWEEN p_from AND p_to
        AND o.tiny_order_id IS NULL
      ORDER BY oh.order_id, oh.created_at ASC
    ) ff
    JOIN orders o ON o.id = ff.order_id
  ),

  -- ═══════════════════════════════════════════
  -- FUNIL REAL: Quantos passaram por cada etapa no período
  -- ═══════════════════════════════════════════
  funil_etapas AS (
    SELECT
      CASE
        WHEN oh.new_value IN ('FAZER', 'AJUSTE') THEN 'Entrada'
        WHEN oh.new_value IN ('APROVACAO', 'APROVADO', 'ARTE_APROVADA') THEN 'Aprovação'
        WHEN oh.new_value = 'PRODUCAO' THEN 'Produção'
        WHEN oh.new_value = 'EXPEDICAO' THEN 'Expedição'
        WHEN oh.new_value IN ('FINALIZADO', 'ENTREGUE', 'FATURADO') THEN 'Finalizado'
        ELSE NULL
      END AS etapa_grupo,
      oh.order_id
    FROM order_history oh
    JOIN orders o ON o.id = oh.order_id
    WHERE oh.action = 'status_changed'
      AND oh.created_at BETWEEN p_from AND p_to
      AND o.tiny_order_id IS NULL

    UNION ALL

    SELECT 'Entrada', o.id
    FROM orders o
    WHERE o.tiny_order_id IS NULL
      AND o.created_at BETWEEN p_from AND p_to
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

  -- ═══════════════════════════════════════════
  -- DISTRIBUIÇÃO POR STATUS (snapshot atual)
  -- ═══════════════════════════════════════════
  por_status AS (
    SELECT
      status::text AS status,
      COUNT(*)::int AS quantidade
    FROM orders
    WHERE tiny_order_id IS NULL AND archived_at IS NULL
    GROUP BY status
  ),
  por_status_arr AS (
    SELECT COALESCE(json_agg(
      json_build_object('status', status, 'quantidade', quantidade)
    ), '[]'::json) AS arr
    FROM por_status
  ),

  -- ═══════════════════════════════════════════
  -- TOP CLIENTES NO PERÍODO
  -- ═══════════════════════════════════════════
  top_clientes AS (
    SELECT
      c.id,
      c.name AS nome,
      c.company AS empresa,
      COUNT(o.id)::int AS totalPedidos
    FROM orders o
    JOIN clients c ON c.id = o.client_id
    WHERE o.tiny_order_id IS NULL
      AND o.created_at BETWEEN p_from AND p_to
    GROUP BY c.id, c.name, c.company
    ORDER BY COUNT(o.id) DESC
    LIMIT 10
  ),
  top_clientes_arr AS (
    SELECT COALESCE(json_agg(
      json_build_object('id', id, 'nome', nome, 'empresa', empresa, 'totalPedidos', totalPedidos)
      ORDER BY totalPedidos DESC
    ), '[]'::json) AS arr
    FROM top_clientes
  ),

  -- ═══════════════════════════════════════════
  -- PEDIDOS POR RESPONSÁVEL
  -- ═══════════════════════════════════════════
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
    WHERE o.tiny_order_id IS NULL AND o.archived_at IS NULL
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

  -- ═══════════════════════════════════════════
  -- TENDÊNCIA MENSAL (últimos 6 meses)
  -- ═══════════════════════════════════════════
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
       WHERE o.tiny_order_id IS NULL
         AND o.created_at >= m.mes
         AND o.created_at < m.mes + INTERVAL '1 month') AS criados,
      (SELECT COUNT(DISTINCT oh.order_id)::int FROM order_history oh
       JOIN orders o ON o.id = oh.order_id
       WHERE oh.action = 'status_changed'
         AND oh.new_value IN ('FINALIZADO', 'ENTREGUE', 'FATURADO')
         AND oh.created_at >= m.mes
         AND oh.created_at < m.mes + INTERVAL '1 month'
         AND o.tiny_order_id IS NULL) AS finalizados
    FROM meses m
  ),
  tendencia_arr AS (
    SELECT COALESCE(json_agg(
      json_build_object('mes', mes, 'mesLabel', mes_label, 'criados', criados, 'finalizados', finalizados)
      ORDER BY mes
    ), '[]'::json) AS arr
    FROM tendencia
  ),

  -- ═══════════════════════════════════════════
  -- PEDIDOS PARADOS (sem mudança de status há X dias)
  -- ═══════════════════════════════════════════
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
    WHERE o.tiny_order_id IS NULL
      AND o.archived_at IS NULL
      AND o.status::text NOT IN ('FINALIZADO', 'ENTREGUE', 'FATURADO')
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

  -- ═══════════════════════════════════════════
  -- RESULTADO FINAL
  -- ═══════════════════════════════════════════
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
