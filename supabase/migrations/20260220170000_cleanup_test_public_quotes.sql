-- Remove os 2 orçamentos públicos de teste (Kairam Cabral 2: "tESTE" e "Logo + telefone")
DELETE FROM public_quotes
WHERE client_name = 'Kairam Cabral 2'
  AND (
    (personalization->>'notes' IS NOT NULL AND personalization->>'notes' ILIKE '%tESTE%')
    OR (personalization->>'notes' IS NOT NULL AND personalization->>'notes' ILIKE '%Logo + telefone%')
  );
