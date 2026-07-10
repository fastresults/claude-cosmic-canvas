
-- Drafts hub: extend create_drafts, create_media; add scheduled_content.

ALTER TABLE public.create_drafts
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS platform text,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS virality_score numeric,
  ADD COLUMN IF NOT EXISTS authenticity_score numeric;

CREATE INDEX IF NOT EXISTS create_drafts_user_updated_idx
  ON public.create_drafts(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS create_drafts_campaign_idx
  ON public.create_drafts(campaign_id) WHERE campaign_id IS NOT NULL;

-- create_media: add per-draft association + generation lineage.
ALTER TABLE public.create_media
  ADD COLUMN IF NOT EXISTS draft_id uuid REFERENCES public.create_drafts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS parent_image_id uuid REFERENCES public.create_media(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS generated_by text,
  ADD COLUMN IF NOT EXISTS aspect_ratio text,
  ADD COLUMN IF NOT EXISTS prompt text,
  ADD COLUMN IF NOT EXISTS style_id text,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS create_media_draft_idx
  ON public.create_media(draft_id, role, sort_order);
CREATE INDEX IF NOT EXISTS create_media_user_idx
  ON public.create_media(user_id, created_at DESC);

-- scheduled_content: outbox for scheduled publishes.
CREATE TABLE IF NOT EXISTS public.scheduled_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  draft_id uuid NOT NULL REFERENCES public.create_drafts(id) ON DELETE CASCADE,
  platform text,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_content TO authenticated;
GRANT ALL ON public.scheduled_content TO service_role;

ALTER TABLE public.scheduled_content ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "scheduled_content owner" ON public.scheduled_content
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS scheduled_content_draft_idx ON public.scheduled_content(draft_id);
CREATE INDEX IF NOT EXISTS scheduled_content_user_time_idx ON public.scheduled_content(user_id, scheduled_at);

DROP TRIGGER IF EXISTS trg_scheduled_content_updated_at ON public.scheduled_content;
CREATE TRIGGER trg_scheduled_content_updated_at
  BEFORE UPDATE ON public.scheduled_content
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
