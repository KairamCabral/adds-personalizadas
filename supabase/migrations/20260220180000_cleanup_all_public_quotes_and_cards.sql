-- Limpa todos os orçamentos públicos e os cards de pedidos (orders) do tipo ORCAMENTO_PUBLICO
-- Ordem: 1) desvincula public_quotes dos orders, 2) deleta orders (cascade), 3) deleta public_quotes

-- 1. Desvincula public_quotes do order_id (para permitir delete dos orders)
UPDATE public_quotes SET order_id = NULL WHERE order_id IS NOT NULL;

-- 2. Deleta orders do tipo ORCAMENTO_PUBLICO (cascade em order_items, order_labels, order_history, etc.)
DELETE FROM orders WHERE order_type = 'ORCAMENTO_PUBLICO';

-- 3. Deleta todos os orçamentos públicos
DELETE FROM public_quotes;
