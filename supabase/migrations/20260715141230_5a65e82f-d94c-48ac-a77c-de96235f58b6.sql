ALTER TABLE public.knowledge_profiles ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS knowledge_profiles_one_default_per_user ON public.knowledge_profiles(user_id) WHERE is_default;

ALTER TABLE public.domains ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS domains_one_default_per_user ON public.domains(user_id) WHERE is_default;