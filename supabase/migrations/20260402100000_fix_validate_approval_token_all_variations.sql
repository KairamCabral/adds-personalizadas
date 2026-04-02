-- Fix validate_approval_token to return ALL artwork variations of the same version.
-- Previously it only returned the single artwork linked to the token,
-- so when a version had 2+ variations only 1 would appear on the approval page.

CREATE OR REPLACE FUNCTION validate_approval_token(p_token TEXT)
RETURNS TABLE (
  is_valid      BOOLEAN,
  is_viewable   BOOLEAN,
  token_id      UUID,
  order_id      UUID,
  artwork_id    UUID,
  order_title   TEXT,
  artwork_url   TEXT,
  used_at       TIMESTAMPTZ,
  used_by_name  TEXT,
  artwork_status TEXT,
  variation_index INTEGER
) AS $$
DECLARE
  v_id           UUID;
  v_order_id     UUID;
  v_artwork_id   UUID;
  v_expires_at   TIMESTAMPTZ;
  v_used_at      TIMESTAMPTZ;
  v_used_by_name TEXT;
  v_version      INTEGER;
BEGIN
  -- Resolve the token
  SELECT at.id, at.order_id, at.artwork_id, at.expires_at, at.used_at, at.used_by_name
  INTO   v_id, v_order_id, v_artwork_id, v_expires_at, v_used_at, v_used_by_name
  FROM   approval_tokens at
  WHERE  at.token = p_token;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Resolve the version of the artwork linked to this token
  SELECT a.version INTO v_version
  FROM   artworks a
  WHERE  a.id = v_artwork_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Return every non-discarded variation of that version
  RETURN QUERY
  SELECT
    (v_used_at IS NULL AND v_expires_at > now())                                        AS is_valid,
    (
      (v_used_at IS NULL  AND v_expires_at > now()) OR
      (v_used_at IS NOT NULL AND (v_used_at + INTERVAL '15 days') > now())
    )                                                                                   AS is_viewable,
    v_id                                                                                AS token_id,
    v_order_id                                                                          AS order_id,
    a.id                                                                                AS artwork_id,
    o.title                                                                             AS order_title,
    a.file_url                                                                          AS artwork_url,
    v_used_at                                                                           AS used_at,
    v_used_by_name                                                                      AS used_by_name,
    a.status::TEXT                                                                      AS artwork_status,
    COALESCE(a.variation_index, 1)::INTEGER                                             AS variation_index
  FROM   artworks a
  JOIN   orders   o ON o.id = a.order_id
  WHERE  a.order_id = v_order_id
    AND  a.version  = v_version
    AND  a.status  <> 'DESCARTADA'
  ORDER BY COALESCE(a.variation_index, 1) ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
