-- ============================================
-- ADDS CRM — Seed: pricing_tiers canal DENTISTA
-- ============================================
-- Espelha os valores hardcoded em src/lib/pricing/dentist-pricing.ts.
-- Idempotente: ON CONFLICT DO UPDATE. Se o produto não existir, não insere nada.
-- Derived prices (P03/P04/P05/P07) pré-computados com calculateDerivedPrice:
--   unit_price = round(msrp * (implantPrice / 34.9) * 100) / 100

DO $$
DECLARE
  v_id UUID;
BEGIN

  -- ── ADDS Implant (P01) ───────────────────────────────────────────────────
  SELECT id INTO v_id FROM public.products
  WHERE name ILIKE '%implant%' AND is_active = true LIMIT 1;
  IF v_id IS NOT NULL THEN
    INSERT INTO public.pricing_tiers (product_id, channel, min_qty, unit_price, is_active)
    VALUES
      (v_id, 'DENTISTA', 24,  24.00, true),
      (v_id, 'DENTISTA', 36,  22.90, true),
      (v_id, 'DENTISTA', 72,  21.90, true),
      (v_id, 'DENTISTA', 120, 19.90, true),
      (v_id, 'DENTISTA', 240, 19.10, true)
    ON CONFLICT (product_id, channel, min_qty)
    DO UPDATE SET unit_price = EXCLUDED.unit_price, is_active = true;
  END IF;

  -- ── ADDS Ultra (P02) ─────────────────────────────────────────────────────
  SELECT id INTO v_id FROM public.products
  WHERE name ILIKE '%ultra%' AND is_active = true LIMIT 1;
  IF v_id IS NOT NULL THEN
    INSERT INTO public.pricing_tiers (product_id, channel, min_qty, unit_price, is_active)
    VALUES
      (v_id, 'DENTISTA', 24,  20.90, true),
      (v_id, 'DENTISTA', 36,  19.90, true),
      (v_id, 'DENTISTA', 72,  18.90, true),
      (v_id, 'DENTISTA', 120, 16.90, true),
      (v_id, 'DENTISTA', 240, 16.40, true)
    ON CONFLICT (product_id, channel, min_qty)
    DO UPDATE SET unit_price = EXCLUDED.unit_price, is_active = true;
  END IF;

  -- ── ADDS OrthoGuard (P03, derived msrp=7.6) ──────────────────────────────
  SELECT id INTO v_id FROM public.products
  WHERE name ILIKE '%orthoguard%' AND is_active = true LIMIT 1;
  IF v_id IS NOT NULL THEN
    INSERT INTO public.pricing_tiers (product_id, channel, min_qty, unit_price, is_active)
    VALUES
      (v_id, 'DENTISTA', 24,  5.23, true),
      (v_id, 'DENTISTA', 36,  4.99, true),
      (v_id, 'DENTISTA', 72,  4.77, true),
      (v_id, 'DENTISTA', 120, 4.33, true),
      (v_id, 'DENTISTA', 240, 4.16, true)
    ON CONFLICT (product_id, channel, min_qty)
    DO UPDATE SET unit_price = EXCLUDED.unit_price, is_active = true;
  END IF;

  -- ── ADDS Expanding (P04, derived msrp=19.9) ──────────────────────────────
  SELECT id INTO v_id FROM public.products
  WHERE name ILIKE '%expanding%' AND is_active = true LIMIT 1;
  IF v_id IS NOT NULL THEN
    INSERT INTO public.pricing_tiers (product_id, channel, min_qty, unit_price, is_active)
    VALUES
      (v_id, 'DENTISTA', 24,  13.68, true),
      (v_id, 'DENTISTA', 36,  13.06, true),
      (v_id, 'DENTISTA', 72,  12.49, true),
      (v_id, 'DENTISTA', 120, 11.35, true),
      (v_id, 'DENTISTA', 240, 10.89, true)
    ON CONFLICT (product_id, channel, min_qty)
    DO UPDATE SET unit_price = EXCLUDED.unit_price, is_active = true;
  END IF;

  -- ── Interdental (P05, derived msrp=14.8) ─────────────────────────────────
  -- Correspondência exata: produto cujo nome normalizado = 'interdental'
  SELECT id INTO v_id FROM public.products
  WHERE lower(trim(name)) = 'interdental' AND is_active = true LIMIT 1;
  IF v_id IS NOT NULL THEN
    INSERT INTO public.pricing_tiers (product_id, channel, min_qty, unit_price, is_active)
    VALUES
      (v_id, 'DENTISTA', 24,  10.18, true),
      (v_id, 'DENTISTA', 36,   9.72, true),
      (v_id, 'DENTISTA', 72,   9.29, true),
      (v_id, 'DENTISTA', 120,  8.44, true),
      (v_id, 'DENTISTA', 240,  8.10, true)
    ON CONFLICT (product_id, channel, min_qty)
    DO UPDATE SET unit_price = EXCLUDED.unit_price, is_active = true;
  END IF;

  -- ── ADDS TechJet (P06, tabela própria) ───────────────────────────────────
  SELECT id INTO v_id FROM public.products
  WHERE name ILIKE '%techjet%' AND is_active = true LIMIT 1;
  IF v_id IS NOT NULL THEN
    INSERT INTO public.pricing_tiers (product_id, channel, min_qty, unit_price, is_active)
    VALUES
      (v_id, 'DENTISTA',  6, 616.85, true),
      (v_id, 'DENTISTA',  8, 588.58, true),
      (v_id, 'DENTISTA', 12, 562.87, true),
      (v_id, 'DENTISTA', 16, 511.47, true),
      (v_id, 'DENTISTA', 24, 490.91, true)
    ON CONFLICT (product_id, channel, min_qty)
    DO UPDATE SET unit_price = EXCLUDED.unit_price, is_active = true;
  END IF;

  -- ── ADDS PassClean (P07, derived msrp=9.9) ───────────────────────────────
  SELECT id INTO v_id FROM public.products
  WHERE name ILIKE '%passclean%' AND is_active = true LIMIT 1;
  IF v_id IS NOT NULL THEN
    INSERT INTO public.pricing_tiers (product_id, channel, min_qty, unit_price, is_active)
    VALUES
      (v_id, 'DENTISTA', 24,  6.81, true),
      (v_id, 'DENTISTA', 36,  6.50, true),
      (v_id, 'DENTISTA', 72,  6.22, true),
      (v_id, 'DENTISTA', 120, 5.65, true),
      (v_id, 'DENTISTA', 240, 5.42, true)
    ON CONFLICT (product_id, channel, min_qty)
    DO UPDATE SET unit_price = EXCLUDED.unit_price, is_active = true;
  END IF;

  -- ── ADDS PróClean (P08, tabela própria) ──────────────────────────────────
  SELECT id INTO v_id FROM public.products
  WHERE (name ILIKE '%próclean%' OR name ILIKE '%proclean%') AND is_active = true LIMIT 1;
  IF v_id IS NOT NULL THEN
    INSERT INTO public.pricing_tiers (product_id, channel, min_qty, unit_price, is_active)
    VALUES
      (v_id, 'DENTISTA', 24,  13.68, true),
      (v_id, 'DENTISTA', 36,  13.06, true),
      (v_id, 'DENTISTA', 72,  12.49, true),
      (v_id, 'DENTISTA', 120, 11.35, true),
      (v_id, 'DENTISTA', 240, 10.89, true)
    ON CONFLICT (product_id, channel, min_qty)
    DO UPDATE SET unit_price = EXCLUDED.unit_price, is_active = true;
  END IF;

  -- ── ADDS TonClean (P09, tabela própria) ──────────────────────────────────
  SELECT id INTO v_id FROM public.products
  WHERE name ILIKE '%tonclean%' AND is_active = true LIMIT 1;
  IF v_id IS NOT NULL THEN
    INSERT INTO public.pricing_tiers (product_id, channel, min_qty, unit_price, is_active)
    VALUES
      (v_id, 'DENTISTA', 24,  6.81, true),
      (v_id, 'DENTISTA', 36,  6.50, true),
      (v_id, 'DENTISTA', 72,  6.21, true),
      (v_id, 'DENTISTA', 120, 5.64, true),
      (v_id, 'DENTISTA', 240, 5.42, true)
    ON CONFLICT (product_id, channel, min_qty)
    DO UPDATE SET unit_price = EXCLUDED.unit_price, is_active = true;
  END IF;

END $$;

-- Garante que o singleton pricing_settings existe com desconto à vista padrão de 5%
INSERT INTO public.pricing_settings (id, avista_discount_pct, min_order_distribuidora, min_order_varejista)
VALUES (true, 5, 0, 0)
ON CONFLICT (id) DO NOTHING;
