-- Create storage bucket for user avatars
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-avatars',
  'user-avatars',
  true,
  1048576, -- 1MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Public read policy (avatars are public)
CREATE POLICY "user-avatars public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'user-avatars');

CREATE POLICY "user-avatars service role insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'user-avatars');

CREATE POLICY "user-avatars service role update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'user-avatars');

CREATE POLICY "user-avatars service role delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'user-avatars');
