-- Adiciona orders.uses_existing_art como flag explícita pra "este pedido reusa
-- arte de cliente recorrente — não precisa nova aprovação". Junto com
-- artwork.status='APROVADA', forma o gate `canMoveToAprovado`:
-- pedido só sobe pra APROVADO se uma das duas condições for verdadeira.
--
-- Backfill conservador: pedidos antigos em EXPEDICAO+ sem nenhuma arte (não
-- contando descartadas) recebem `uses_existing_art=true`. Cobre clientes
-- recorrentes históricos que avançaram sem o gate (≈25 pedidos hoje).
-- Não toca pedidos com artes em PENDENTE/AJUSTE_SOLICITADO — esses são
-- bugs reais que o user revisa caso a caso.
--
-- Multi-app: rep-app não consome esta coluna. Adicionar nullable + default
-- false é não-breaking.

BEGIN;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS uses_existing_art BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN orders.uses_existing_art IS
  'TRUE quando o pedido reusa arte de cliente recorrente (sem necessidade '
  'de aprovação nova). Junto com artwork.status=APROVADA, forma o gate '
  'canMoveToAprovado — bloqueia transição pra APROVADO sem arte aprovada.';

-- Backfill conservador: pedidos histó­ricos que avançaram pra EXPEDICAO+
-- sem nenhuma arte (incluindo descartadas) — clientes recorrentes que
-- usaram fluxo manual sem gate.
UPDATE orders o
SET uses_existing_art = TRUE
WHERE uses_existing_art = FALSE
  AND archived_at IS NULL
  AND status IN ('APROVADO', 'PRODUCAO', 'EXPEDICAO', 'FINALIZADO', 'ENTREGUE', 'FATURADO')
  AND NOT EXISTS (
    SELECT 1 FROM artworks a
    WHERE a.order_id = o.id
      AND a.status != 'DESCARTADA'
  );

COMMIT;
