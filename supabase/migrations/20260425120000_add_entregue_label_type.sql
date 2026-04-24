-- Tag "Entregue" no pedido; etapa final continua FINALIZADO (não colunas ENTREGUE/FATURADO).
DO $migration$
BEGIN
  ALTER TYPE label_type ADD VALUE 'ENTREGUE';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$migration$;
