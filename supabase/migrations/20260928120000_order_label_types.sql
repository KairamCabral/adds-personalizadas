-- Etiquetas de pedido: CRUD (inserir/editar/excluir) via TABELA.
--
-- Antes: `order_labels.label` era o enum `label_type` + config hardcoded em
-- src/lib/constants.ts. Enum não permite excluir valor nem inserir sem migration.
-- Agora: catálogo editável `order_label_types` (slug = valor gravado em
-- order_labels.label) e `order_labels.label` vira TEXTO com FK para o catálogo.
--
-- O tipo `label_type` NÃO é dropado (segue usado pela tabela de snapshot
-- order_labels_backup_20260429140000). Só `order_labels.label` deixa de usá-lo.
-- Única função que comparava contra a coluna (`get_dashboard_crm`) é recriada
-- trocando `'PEDIDO_CANCELADO'::label_type` por texto.
--
-- Idempotente: pode ser reaplicada com segurança.

-- ============================================================
-- 1) Catálogo editável de etiquetas
-- ============================================================
CREATE TABLE IF NOT EXISTS order_label_types (
  slug        text PRIMARY KEY,               -- valor gravado em order_labels.label
  name        text NOT NULL,                  -- exibição (ex.: "Atenção!")
  color       text NOT NULL,                  -- cor de fundo (hex)
  text_color  text NOT NULL DEFAULT '#ffffff',-- cor do texto (hex)
  sort_order  int  NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  is_system   boolean NOT NULL DEFAULT false, -- etiquetas de automação: não podem ser excluídas
  created_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_label_types_active
  ON order_label_types(is_active, sort_order);

DROP TRIGGER IF EXISTS trg_order_label_types_updated ON order_label_types;
CREATE TRIGGER trg_order_label_types_updated
  BEFORE UPDATE ON order_label_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS: todos leem; MASTER/GESTOR gerenciam (espelha order_labels).
ALTER TABLE order_label_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_label_types_select ON order_label_types;
CREATE POLICY order_label_types_select ON order_label_types
  FOR SELECT USING (true);

DROP POLICY IF EXISTS order_label_types_insert ON order_label_types;
CREATE POLICY order_label_types_insert ON order_label_types
  FOR INSERT WITH CHECK (get_user_role() IN ('MASTER', 'GESTOR'));

DROP POLICY IF EXISTS order_label_types_update ON order_label_types;
CREATE POLICY order_label_types_update ON order_label_types
  FOR UPDATE USING (get_user_role() IN ('MASTER', 'GESTOR'))
  WITH CHECK (get_user_role() IN ('MASTER', 'GESTOR'));

DROP POLICY IF EXISTS order_label_types_delete ON order_label_types;
CREATE POLICY order_label_types_delete ON order_label_types
  FOR DELETE USING (get_user_role() IN ('MASTER', 'GESTOR'));

-- Seed dos 11 valores atuais (slug/name/cor iguais a src/lib/constants.ts LABELS).
-- is_system = true nas 8 acopladas a automação/SQL (não excluíveis pela UI).
INSERT INTO order_label_types (slug, name, color, sort_order, is_system) VALUES
  ('PAGO',                       'Pago',                           '#16a34a',  1, true),
  ('BOLETO',                     'Boleto',                         '#3b82f6',  2, false),
  ('AGUARDANDO_PAGAMENTO',       'Aguardando Pagamento',           '#f59e0b',  3, true),
  ('APROV_AGUARDANDO_PAGAMENTO', 'Aprovado! Aguardando Pagamento', '#f97316',  4, true),
  ('PEDIDO_CANCELADO',           'Pedido Cancelado',               '#ef4444',  5, true),
  ('AMOSTRAS',                   'Amostras',                       '#8b5cf6',  6, false),
  ('ORCAMENTO_PUBLICO',          'Orçamento Público',              '#21add6',  7, true),
  ('LINK_ENVIADO',               'Link enviado',                   '#1e40af',  8, true),
  ('ARTE_APROVADA',              'Arte aprovada',                  '#059669',  9, true),
  ('ENTREGUE',                   'Entregue',                       '#0f766e', 10, true),
  ('ATENCAO',                    'Atenção!',                       '#dc2626', 11, false)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 2) order_labels.label: enum label_type -> text (mesmos valores)
-- ============================================================
ALTER TABLE order_labels ALTER COLUMN label TYPE text USING label::text;

-- FK slug (o seed acima garante que todos os valores atuais existem no catálogo).
-- ON DELETE RESTRICT: não dá pra excluir um tipo em uso (a UI oferece "desativar").
DO $fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_labels_label_fkey'
  ) THEN
    ALTER TABLE order_labels
      ADD CONSTRAINT order_labels_label_fkey
      FOREIGN KEY (label) REFERENCES order_label_types(slug)
      ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;
END
$fk$;

-- ============================================================
-- 3) Recria get_dashboard_crm (vigente: 20260426200000) trocando os 4 casts
--    `'PEDIDO_CANCELADO'::label_type` por comparação de texto (a coluna virou text).
--    Corpo idêntico ao original — só os casts mudam.
-- ============================================================
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
    WHERE label = 'PEDIDO_CANCELADO'
  ),

  kpis AS (
    SELECT
      (SELECT COUNT(*)::int FROM clients) AS total_clientes,
      (SELECT COUNT(*)::int FROM clients
       WHERE created_at >= p_from AND created_at <= p_to) AS novos_clientes,
      (SELECT COUNT(*)::int FROM clients c, periodo p
       WHERE c.created_at >= p.prev_from AND c.created_at <= p.prev_to) AS novos_clientes_prev,

      (SELECT total FROM pipeline_quadro) AS pedidos_ativos,

      (SELECT COUNT(*)::int FROM pedidos_crm o
       WHERE o.due_date IS NOT NULL
         AND o.due_date < CURRENT_DATE
         AND o.archived_at IS NULL
         AND o.status::text NOT IN ('FINALIZADO', 'ARQUIVADO')
         AND NOT EXISTS (SELECT 1 FROM pedido_com_cancelado c WHERE c.order_id = o.id)
      ) AS pedidos_atrasados,

      (SELECT COUNT(*)::int FROM pedidos_crm o
       WHERE o.created_at >= p_from AND o.created_at <= p_to) AS pedidos_criados,

      (SELECT COUNT(*)::int FROM pedidos_crm o, periodo p
       WHERE o.created_at >= p.prev_from AND o.created_at <= p.prev_to) AS pedidos_criados_prev,

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

      (SELECT COUNT(DISTINCT ol.order_id)::int FROM order_labels ol
       WHERE ol.label = 'PEDIDO_CANCELADO'
         AND ol.created_at >= p_from AND ol.created_at <= p_to
         AND ol.order_id IN (SELECT id FROM pedidos_crm WHERE archived_at IS NULL)
      ) AS pedidos_cancelados,

      (SELECT COUNT(*)::int FROM pedidos_crm o
       WHERE o.archived_at IS NOT NULL
         AND o.archived_at >= p_from AND o.archived_at <= p_to
         AND NOT EXISTS (SELECT 1 FROM pedido_com_cancelado c WHERE c.order_id = o.id)
      ) AS pedidos_arquivados,

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
      AND oh.old_value NOT IN ('FATURADO', 'ARQUIVADO')
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
    WHERE ol.label = 'PEDIDO_CANCELADO'
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
    SELECT 'Em andamento', (SELECT total FROM pipeline_quadro), 4
  ),

  funil_arr AS (
    SELECT COALESCE(json_agg(
      json_build_object('etapa', etapa, 'quantidade', quantidade, 'ordem', ordem)
      ORDER BY ordem
    ), '[]'::json) AS arr
    FROM funil
  ),

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
    WHERE ol.label = 'PEDIDO_CANCELADO'
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
'Dashboard CRM: pedidos reais (março+ ou status_changed) + geridos no pipeline; ativos/funil em andamento = total do Kanban; FATURADO excluído do tempo por etapa. (order_labels.label agora é text — comparação por slug.)';
