-- Adiciona coluna only_mapped_products na tabela suppliers.
-- Quando true, o sistema envia ao Bling apenas os produtos com
-- mapeamento de SKU configurado (bling_sku / bling_color_sku_map),
-- ignorando itens extras do Tiny. Ideal para fornecedores de personalização.

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS only_mapped_products BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN suppliers.only_mapped_products IS
  'Quando true, pedidos enviados ao Bling incluem somente produtos com SKU Bling mapeado. Itens extras do Tiny são ignorados.';
