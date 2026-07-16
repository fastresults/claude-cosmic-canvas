CREATE TABLE public.default_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  emoji TEXT,
  voice_id UUID REFERENCES public.voice_profiles(id) ON DELETE SET NULL,
  knowledge_profile_id UUID REFERENCES public.knowledge_profiles(id) ON DELETE SET NULL,
  domain_id UUID REFERENCES public.domains(id) ON DELETE SET NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  use_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX default_profiles_one_default_per_user
  ON public.default_profiles(user_id) WHERE is_default;

CREATE INDEX default_profiles_user_idx ON public.default_profiles(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.default_profiles TO authenticated;
GRANT ALL ON public.default_profiles TO service_role;

ALTER TABLE public.default_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own default profiles"
  ON public.default_profiles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER default_profiles_set_updated_at
  BEFORE UPDATE ON public.default_profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();