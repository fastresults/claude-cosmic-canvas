
-- ============ Enums ============
DO $$ BEGIN
  CREATE TYPE public.voice_signal_type AS ENUM ('edit','approval','rejection','regeneration');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.voice_directive_type AS ENUM ('avoid_word','prefer_word','avoid_pattern','prefer_pattern','tone_shift','structural');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.voice_directive_status AS ENUM ('suggested','active','dismissed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ voice_profiles: extend ============
ALTER TABLE public.voice_profiles
  ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT 'Untitled voice',
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS tone text,
  ADD COLUMN IF NOT EXISTS guidelines text,
  ADD COLUMN IF NOT EXISTS vocabulary_preferred text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS vocabulary_avoid text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS formality int NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS humor int NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS technicality int NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS conciseness int NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'scratch';

-- Clamp sliders 0..100
DO $$ BEGIN
  ALTER TABLE public.voice_profiles
    ADD CONSTRAINT voice_profiles_sliders_range CHECK (
      formality BETWEEN 0 AND 100 AND humor BETWEEN 0 AND 100
      AND technicality BETWEEN 0 AND 100 AND conciseness BETWEEN 0 AND 100
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- One default per (user_id, persona_id) scope; persona_id NULL = personal scope
CREATE UNIQUE INDEX IF NOT EXISTS voice_profiles_one_default_per_scope
  ON public.voice_profiles (user_id, COALESCE(persona_id::text, ''))
  WHERE is_default;

-- ============ profiles: active voice pointer ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_voice_id uuid REFERENCES public.voice_profiles(id) ON DELETE SET NULL;

-- ============ system_voices ============
CREATE TABLE IF NOT EXISTS public.system_voices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  profession text,
  tagline text,
  category text,
  tone text,
  guidelines text,
  samples jsonb NOT NULL DEFAULT '[]',
  vocabulary_preferred text[] NOT NULL DEFAULT '{}',
  vocabulary_avoid text[] NOT NULL DEFAULT '{}',
  formality int NOT NULL DEFAULT 50 CHECK (formality BETWEEN 0 AND 100),
  humor int NOT NULL DEFAULT 50 CHECK (humor BETWEEN 0 AND 100),
  technicality int NOT NULL DEFAULT 50 CHECK (technicality BETWEEN 0 AND 100),
  conciseness int NOT NULL DEFAULT 50 CHECK (conciseness BETWEEN 0 AND 100),
  is_visible boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.system_voices TO anon, authenticated;
GRANT ALL ON public.system_voices TO service_role;
ALTER TABLE public.system_voices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system_voices public read" ON public.system_voices;
CREATE POLICY "system_voices public read" ON public.system_voices
  FOR SELECT USING (is_visible = true);

DROP POLICY IF EXISTS "system_voices admin write" ON public.system_voices;
CREATE POLICY "system_voices admin write" ON public.system_voices
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_system_voices_updated_at ON public.system_voices;
CREATE TRIGGER trg_system_voices_updated_at
  BEFORE UPDATE ON public.system_voices
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ voice_signals ============
CREATE TABLE IF NOT EXISTS public.voice_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  voice_profile_id uuid REFERENCES public.voice_profiles(id) ON DELETE CASCADE,
  persona_id uuid REFERENCES public.personas(id) ON DELETE SET NULL,
  signal_type public.voice_signal_type NOT NULL,
  original_text text NOT NULL,
  edited_text text,
  context jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

GRANT SELECT, INSERT ON public.voice_signals TO authenticated;
GRANT ALL ON public.voice_signals TO service_role;
ALTER TABLE public.voice_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "voice_signals own read" ON public.voice_signals;
CREATE POLICY "voice_signals own read" ON public.voice_signals
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "voice_signals own insert" ON public.voice_signals;
CREATE POLICY "voice_signals own insert" ON public.voice_signals
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS voice_signals_user_unprocessed_idx
  ON public.voice_signals (user_id, created_at)
  WHERE processed_at IS NULL;

-- ============ voice_directives ============
CREATE TABLE IF NOT EXISTS public.voice_directives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  voice_profile_id uuid NOT NULL REFERENCES public.voice_profiles(id) ON DELETE CASCADE,
  persona_id uuid REFERENCES public.personas(id) ON DELETE SET NULL,
  directive_type public.voice_directive_type NOT NULL,
  directive_text text NOT NULL,
  evidence_count int NOT NULL DEFAULT 1,
  status public.voice_directive_status NOT NULL DEFAULT 'suggested',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS voice_directives_unique_text
  ON public.voice_directives (voice_profile_id, directive_type, lower(directive_text));

CREATE INDEX IF NOT EXISTS voice_directives_profile_status_idx
  ON public.voice_directives (voice_profile_id, status, evidence_count DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_directives TO authenticated;
GRANT ALL ON public.voice_directives TO service_role;
ALTER TABLE public.voice_directives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "voice_directives own" ON public.voice_directives;
CREATE POLICY "voice_directives own" ON public.voice_directives
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_voice_directives_updated_at ON public.voice_directives;
CREATE TRIGGER trg_voice_directives_updated_at
  BEFORE UPDATE ON public.voice_directives
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ voice_learning_settings ============
CREATE TABLE IF NOT EXISTS public.voice_learning_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  auto_promote_threshold int NOT NULL DEFAULT 3 CHECK (auto_promote_threshold BETWEEN 1 AND 50),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_learning_settings TO authenticated;
GRANT ALL ON public.voice_learning_settings TO service_role;
ALTER TABLE public.voice_learning_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "voice_learning_settings own" ON public.voice_learning_settings;
CREATE POLICY "voice_learning_settings own" ON public.voice_learning_settings
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_voice_learning_settings_updated_at ON public.voice_learning_settings;
CREATE TRIGGER trg_voice_learning_settings_updated_at
  BEFORE UPDATE ON public.voice_learning_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
