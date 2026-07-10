
-- ============ audiences (mirrors domains) ============
CREATE TABLE public.audiences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audiences TO authenticated;
GRANT ALL ON public.audiences TO service_role;
ALTER TABLE public.audiences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audiences_owner_all" ON public.audiences
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ presets ============
CREATE TABLE public.presets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  brief_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  selected_domain_ids UUID[] NOT NULL DEFAULT '{}',
  selected_audience_ids UUID[] NOT NULL DEFAULT '{}',
  factor_weights JSONB NOT NULL DEFAULT '{}'::jsonb,
  research_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_used_snapshot JSONB,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMPTZ,
  use_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.presets TO authenticated;
GRANT ALL ON public.presets TO service_role;
ALTER TABLE public.presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "presets_owner_all" ON public.presets
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE UNIQUE INDEX presets_one_default_per_user
  ON public.presets (user_id) WHERE is_default;

CREATE TRIGGER presets_set_updated_at
  BEFORE UPDATE ON public.presets
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ preset_documents ============
CREATE TABLE public.preset_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  preset_id UUID NOT NULL REFERENCES public.presets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('url','file','paste','linkedin','resume','voice')),
  source_url TEXT,
  file_name TEXT,
  file_type TEXT,
  file_size INTEGER,
  extracted_text TEXT,
  structured JSONB,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high')),
  knowledge_entry_id UUID REFERENCES public.knowledge_entries(id) ON DELETE SET NULL,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.preset_documents TO authenticated;
GRANT ALL ON public.preset_documents TO service_role;
ALTER TABLE public.preset_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "preset_documents_owner_all" ON public.preset_documents
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX preset_documents_preset_idx ON public.preset_documents (preset_id);

-- ============ preset_usage ============
CREATE TABLE public.preset_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  preset_id UUID NOT NULL REFERENCES public.presets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  surface TEXT,
  used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.preset_usage TO authenticated;
GRANT ALL ON public.preset_usage TO service_role;
ALTER TABLE public.preset_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "preset_usage_owner_all" ON public.preset_usage
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX preset_usage_preset_idx ON public.preset_usage (preset_id, used_at DESC);
