-- Tag "Arte aprovada": aplicada no pedido quando o cliente aprova a arte via
-- link público (/api/art/approve e approve-bundle). Substitui visualmente a
-- tag LINK_ENVIADO, sinalizando que a aprovação foi recebida. A etapa do
-- pedido segue o fluxo normal (CONFIRMACAO ou APROVADO se PAGO).
DO $migration$
BEGIN
  ALTER TYPE label_type ADD VALUE 'ARTE_APROVADA';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$migration$;
