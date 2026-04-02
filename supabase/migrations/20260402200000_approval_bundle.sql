-- ============================================================
-- Approval Bundle support
-- Cenário 1 fix: is_bundle=false tokens já funcionam com variações
-- Cenário 2: is_bundle=true agrupa múltiplas artes independentes
-- ============================================================

-- 1. Add is_bundle flag to approval_tokens
ALTER TABLE approval_tokens
  ADD COLUMN IF NOT EXISTS is_bundle BOOLEAN NOT NULL DEFAULT false;

-- 2. Bundle items: each row = one artwork in a bundle, with a custom label
CREATE TABLE IF NOT EXISTS approval_bundle_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id      UUID NOT NULL REFERENCES approval_tokens(id) ON DELETE CASCADE,
  artwork_id    UUID NOT NULL REFERENCES artworks(id)        ON DELETE CASCADE,
  artwork_label TEXT NOT NULL DEFAULT '',
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (token_id, artwork_id)
);

CREATE INDEX IF NOT EXISTS idx_bundle_items_token ON approval_bundle_items(token_id);

-- RLS: public read (for token validation), authenticated write
ALTER TABLE approval_bundle_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "approval_bundle_items_public_read" ON approval_bundle_items
  FOR SELECT USING (true);

CREATE POLICY "approval_bundle_items_auth_write" ON approval_bundle_items
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================
-- 3. Recreate validate_approval_token with bundle support
--    New return columns: is_bundle BOOLEAN, artwork_label TEXT
-- ============================================================

DROP FUNCTION IF EXISTS validate_approval_token(text);

CREATE OR REPLACE FUNCTION validate_approval_token(p_token TEXT)
RETURNS TABLE (
  is_valid        BOOLEAN,
  is_viewable     BOOLEAN,
  is_bundle       BOOLEAN,
  token_id        UUID,
  order_id        UUID,
  artwork_id      UUID,
  order_title     TEXT,
  artwork_url     TEXT,
  used_at         TIMESTAMPTZ,
  used_by_name    TEXT,
  artwork_status  TEXT,
  variation_index INTEGER,
  artwork_label   TEXT
) AS $$
DECLARE
  v_id           UUID;
  v_order_id     UUID;
  v_artwork_id   UUID;
  v_expires_at   TIMESTAMPTZ;
  v_used_at      TIMESTAMPTZ;
  v_used_by_name TEXT;
  v_version      INTEGER;
  v_is_bundle    BOOLEAN;
BEGIN
  SELECT at.id, at.order_id, at.artwork_id, at.expires_at,
         at.used_at, at.used_by_name, COALESCE(at.is_bundle, false)
  INTO   v_id, v_order_id, v_artwork_id, v_expires_at,
         v_used_at, v_used_by_name, v_is_bundle
  FROM   approval_tokens at
  WHERE  at.token = p_token;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_is_bundle THEN
    -- Bundle mode: each item gets its own row with current artwork status
    RETURN QUERY
    SELECT
      (v_used_at IS NULL AND v_expires_at > now())                                        AS is_valid,
      (v_used_at IS NOT NULL AND (v_used_at + INTERVAL '15 days') > now())                AS is_viewable,
      true                                                                                 AS is_bundle,
      v_id                                                                                 AS token_id,
      v_order_id                                                                           AS order_id,
      a.id                                                                                 AS artwork_id,
      o.title                                                                              AS order_title,
      a.file_url                                                                           AS artwork_url,
      v_used_at                                                                            AS used_at,
      v_used_by_name                                                                       AS used_by_name,
      a.status::TEXT                                                                       AS artwork_status,
      abi.sort_order::INTEGER                                                              AS variation_index,
      COALESCE(abi.artwork_label, '')                                                      AS artwork_label
    FROM   approval_bundle_items abi
    JOIN   artworks a ON a.id = abi.artwork_id
    JOIN   orders   o ON o.id = v_order_id
    WHERE  abi.token_id = v_id
    ORDER BY abi.sort_order ASC;

  ELSE
    -- Variation mode (existing logic): all non-discarded artworks of same version
    SELECT a.version INTO v_version
    FROM   artworks a
    WHERE  a.id = v_artwork_id;

    IF NOT FOUND THEN
      RETURN;
    END IF;

    RETURN QUERY
    SELECT
      (v_used_at IS NULL AND v_expires_at > now())                                        AS is_valid,
      (
        (v_used_at IS NULL  AND v_expires_at > now()) OR
        (v_used_at IS NOT NULL AND (v_used_at + INTERVAL '15 days') > now())
      )                                                                                   AS is_viewable,
      false                                                                               AS is_bundle,
      v_id                                                                                AS token_id,
      v_order_id                                                                          AS order_id,
      a.id                                                                                AS artwork_id,
      o.title                                                                             AS order_title,
      a.file_url                                                                          AS artwork_url,
      v_used_at                                                                           AS used_at,
      v_used_by_name                                                                      AS used_by_name,
      a.status::TEXT                                                                      AS artwork_status,
      COALESCE(a.variation_index, 1)::INTEGER                                             AS variation_index,
      NULL::TEXT                                                                          AS artwork_label
    FROM   artworks a
    JOIN   orders   o ON o.id = a.order_id
    WHERE  a.order_id = v_order_id
      AND  a.version  = v_version
      AND  a.status  <> 'DESCARTADA'
    ORDER BY COALESCE(a.variation_index, 1) ASC;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
