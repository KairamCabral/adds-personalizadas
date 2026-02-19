-- Create storage bucket for public quote logos
-- Run this migration manually if the bucket doesn't exist: pnpm supabase db push
-- Or execute in Supabase Dashboard > SQL Editor

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'quote-logos',
  'quote-logos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Allow public insert for quote logos (anonymous quote form)
CREATE POLICY "Public insert quote logos"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'quote-logos');

-- Allow public read for quote logos
CREATE POLICY "Public read quote logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'quote-logos');
