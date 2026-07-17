
-- 1. Extend audiences into a rich ICP entity
ALTER TABLE public.audiences
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS icp jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS emoji text,
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_ai_generated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_domain_id uuid REFERENCES public.domains(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_knowledge_profile_id uuid REFERENCES public.knowledge_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS audiences_one_default_per_user
  ON public.audiences(user_id) WHERE is_default;

DROP TRIGGER IF EXISTS audiences_set_updated_at ON public.audiences;
CREATE TRIGGER audiences_set_updated_at
  BEFORE UPDATE ON public.audiences
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Ensure grants + RLS are in place (idempotent)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audiences TO authenticated;
GRANT ALL ON public.audiences TO service_role;
ALTER TABLE public.audiences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own audiences" ON public.audiences;
CREATE POLICY "Users manage own audiences"
  ON public.audiences
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. Wire audience into default_profiles bundle
ALTER TABLE public.default_profiles
  ADD COLUMN IF NOT EXISTS audience_id uuid REFERENCES public.audiences(id) ON DELETE SET NULL;

-- 3. Wire audience into drafts (keep legacy text column)
ALTER TABLE public.create_drafts
  ADD COLUMN IF NOT EXISTS audience_id uuid REFERENCES public.audiences(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS create_drafts_audience_id_idx
  ON public.create_drafts(audience_id) WHERE audience_id IS NOT NULL;

-- 4. Backfill: distinct legacy draft.audience strings -> audiences rows, then link + default
DO $$
DECLARE
  r record;
BEGIN
  -- Insert one audience row per (user, distinct non-empty legacy string) that doesn't already exist by name
  FOR r IN
    SELECT DISTINCT d.user_id, btrim(d.audience) AS name
    FROM public.create_drafts d
    WHERE d.audience IS NOT NULL
      AND btrim(d.audience) <> ''
  LOOP
    INSERT INTO public.audiences (user_id, name)
    SELECT r.user_id, r.name
    WHERE NOT EXISTS (
      SELECT 1 FROM public.audiences a
      WHERE a.user_id = r.user_id AND lower(a.name) = lower(r.name)
    );
  END LOOP;

  -- Link drafts to their matching audience row
  UPDATE public.create_drafts d
  SET audience_id = a.id
  FROM public.audiences a
  WHERE d.audience_id IS NULL
    AND d.user_id = a.user_id
    AND d.audience IS NOT NULL
    AND lower(btrim(d.audience)) = lower(a.name);

  -- For each user with no default yet, mark the most-used audience as default
  FOR r IN
    SELECT user_id FROM public.audiences
    GROUP BY user_id
    HAVING bool_and(is_default = false)
  LOOP
    UPDATE public.audiences
    SET is_default = true
    WHERE id = (
      SELECT a.id
      FROM public.audiences a
      LEFT JOIN public.create_drafts d ON d.audience_id = a.id
      WHERE a.user_id = r.user_id
      GROUP BY a.id
      ORDER BY count(d.id) DESC, a.created_at ASC
      LIMIT 1
    );
  END LOOP;
END $$;
