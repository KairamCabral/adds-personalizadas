-- Adiciona orders.tiny_sync_hash para short-circuit no re-sync via webhook
-- atualizacao_pedido. Hash codifica cliente + itens + endereço + situação do
-- snapshot Tiny no último sync — se hash bater, webhook é no-op.
--
-- Nullable, sem default: pedidos pré-existentes ficam com NULL; primeiro
-- webhook recalcula e grava. RLS herda row policy de orders (sem mudança).
--
-- Multi-app: o rep-app não lê esta coluna; adicionar nullable é não-breaking.

BEGIN;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS tiny_sync_hash TEXT;

COMMENT ON COLUMN orders.tiny_sync_hash IS
  'SHA-256 do snapshot Tiny do último re-sync (cliente + itens + endereço + situação). '
  'NULL = nunca sincronizado. Usado por handlePedido/atualizacao_pedido para evitar '
  'reprocessar o mesmo payload.';

COMMIT;
