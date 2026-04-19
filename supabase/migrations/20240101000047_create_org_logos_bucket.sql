-- Create storage bucket for organization logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'org-logos',
  'org-logos',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Public read policy (logos are public)
CREATE POLICY "org-logos public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'org-logos');

-- Authenticated upload/update policy (handled via service role in API)
CREATE POLICY "org-logos service role write"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'org-logos');

CREATE POLICY "org-logos service role update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'org-logos');

CREATE POLICY "org-logos service role delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'org-logos');
