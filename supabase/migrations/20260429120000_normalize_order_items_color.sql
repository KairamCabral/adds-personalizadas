-- Normaliza order_items: cor sai do nome e vai para colunas dedicadas.
--
-- Antes: product_name vinha como "ADDS Implant – Lilás" (concat na ingestão Tiny).
-- Depois: product_name = nome canônico do produto; color/color_name carregam a cor.
--
-- Idempotente: rodar 2× é no-op no segundo passe.
-- Cria snapshot em order_items_backup_20260429120000 antes de qualquer UPDATE.
-- Rollback manual: ver supabase/manual/20260429120000_rollback_normalize_order_items_color.sql

BEGIN;

-- 1) Snapshot das linhas que serão modificadas
CREATE TABLE IF NOT EXISTS order_items_backup_20260429120000 AS
SELECT
  id,
  product_name,
  color,
  color_name,
  personalization,
  NOW() AS backed_up_at
FROM order_items
WHERE
  -- a) linhas com sufixo de cor no nome (regex: hífen/en-dash/em-dash + texto até o fim)
  product_name ~ '\s*[-–—]\s*[^-–—]+$'
  -- b) ou linhas com personalization.colors mas color/color_name nulos
  OR (
    color IS NULL
    AND color_name IS NULL
    AND personalization IS NOT NULL
    AND jsonb_typeof(personalization->'colors') = 'array'
    AND jsonb_array_length(personalization->'colors') > 0
    AND (personalization->'colors'->>0) IS NOT NULL
  );

ALTER TABLE order_items_backup_20260429120000 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "master_only" ON order_items_backup_20260429120000;
CREATE POLICY "master_only" ON order_items_backup_20260429120000
  FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'MASTER')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'MASTER');

-- 2) Backfill color/color_name a partir de personalization.colors[0]
UPDATE order_items oi
SET
  color = (oi.personalization->'colors'->>0),
  color_name = COALESCE(
    (
      SELECT col->>'label'
      FROM products p,
           jsonb_array_elements(p.available_colors) AS col
      WHERE p.id = oi.product_id
        AND (col->>'key') = (oi.personalization->'colors'->>0)
      LIMIT 1
    ),
    -- fallback: capitaliza o key (ex: "lilas" -> "Lilas") quando produto não tem essa cor cadastrada
    INITCAP(oi.personalization->'colors'->>0)
  )
WHERE oi.color IS NULL
  AND oi.color_name IS NULL
  AND oi.product_id IS NOT NULL
  AND jsonb_typeof(oi.personalization->'colors') = 'array'
  AND jsonb_array_length(oi.personalization->'colors') > 0
  AND (oi.personalization->'colors'->>0) IS NOT NULL;

-- 3) Despe sufixo de cor: pega o nome canônico do produto.
--    Só atua quando: product_id existe, há divergência com products.name e o sufixo bate com regex.
--    Idempotente: na 2a execução não há divergência, ninguém é atualizado.
UPDATE order_items oi
SET product_name = p.name
FROM products p
WHERE oi.product_id = p.id
  AND oi.product_name <> p.name
  AND oi.product_name ~ '\s*[-–—]\s*[^-–—]+$';

COMMIT;
