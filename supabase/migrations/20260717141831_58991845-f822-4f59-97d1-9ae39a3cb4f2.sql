
-- Media Hub: per-user asset table + storage policies
CREATE TABLE public.media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0,
  storage_path text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('image','document','audio','video','other')),
  title text NOT NULL,
  description text,
  tags text[] NOT NULL DEFAULT '{}',
  width int,
  height int,
  duration_seconds numeric,
  checksum text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX media_assets_user_created_idx ON public.media_assets (user_id, created_at DESC);
CREATE INDEX media_assets_user_kind_idx ON public.media_assets (user_id, kind);
CREATE INDEX media_assets_tags_gin_idx ON public.media_assets USING gin (tags);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_assets TO authenticated;
GRANT ALL ON public.media_assets TO service_role;

ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own media" ON public.media_assets
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own media" ON public.media_assets
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own media" ON public.media_assets
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own media" ON public.media_assets
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER media_assets_set_updated_at
  BEFORE UPDATE ON public.media_assets
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Link draft-scoped media rows back to hub assets (optional dedupe)
ALTER TABLE public.create_media
  ADD COLUMN IF NOT EXISTS media_asset_id uuid REFERENCES public.media_assets(id) ON DELETE SET NULL;

-- Storage RLS: user CRUDs objects under media-hub/<userId>/...
CREATE POLICY "Users read own media-hub objects" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'media-hub' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users insert own media-hub objects" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media-hub' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users update own media-hub objects" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'media-hub' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'media-hub' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete own media-hub objects" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'media-hub' AND (storage.foldername(name))[1] = auth.uid()::text);
