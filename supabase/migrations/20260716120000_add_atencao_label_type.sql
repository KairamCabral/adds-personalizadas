-- Etiqueta "Atenção!" (vermelha): aplicada manualmente aos pedidos no pipeline
-- para sinalizar algo que exige atenção da equipe. Apenas adiciona o valor ao
-- enum; a exibição/cor fica em src/lib/constants.ts (LABELS).
DO $migration$
BEGIN
  ALTER TYPE label_type ADD VALUE 'ATENCAO';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$migration$;
