
-- Rate limits: token-bucket-ish per (user, endpoint)
CREATE TABLE public.rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('minute', now()),
  count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint, window_start)
);
CREATE INDEX rate_limits_user_endpoint_idx ON public.rate_limits(user_id, endpoint, window_start DESC);
GRANT SELECT ON public.rate_limits TO authenticated;
GRANT ALL ON public.rate_limits TO service_role;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rate_limits self read" ON public.rate_limits FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_endpoint TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER DEFAULT 60
) RETURNS TABLE(allowed BOOLEAN, remaining INTEGER, reset_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_window TIMESTAMPTZ := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count INTEGER;
BEGIN
  IF v_user IS NULL THEN
    RETURN QUERY SELECT false, 0, now();
    RETURN;
  END IF;
  INSERT INTO public.rate_limits (user_id, endpoint, window_start, count)
  VALUES (v_user, p_endpoint, v_window, 1)
  ON CONFLICT (user_id, endpoint, window_start)
  DO UPDATE SET count = public.rate_limits.count + 1
  RETURNING count INTO v_count;
  RETURN QUERY SELECT (v_count <= p_limit), GREATEST(p_limit - v_count, 0), v_window + make_interval(secs => p_window_seconds);
END;
$$;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(TEXT, INTEGER, INTEGER) TO authenticated;

-- Soft delete on drafts, create_drafts, media_assets
ALTER TABLE public.drafts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.create_drafts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.media_assets ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS drafts_deleted_at_idx ON public.drafts(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS create_drafts_deleted_at_idx ON public.create_drafts(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS media_assets_deleted_at_idx ON public.media_assets(deleted_at) WHERE deleted_at IS NOT NULL;

-- Feature flags: global + optional per-user override
CREATE TABLE public.feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.feature_flags TO authenticated, anon;
GRANT ALL ON public.feature_flags TO service_role;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feature_flags public read" ON public.feature_flags FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "feature_flags admin write" ON public.feature_flags FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.feature_flag_overrides (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key TEXT NOT NULL REFERENCES public.feature_flags(key) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);
GRANT SELECT ON public.feature_flag_overrides TO authenticated;
GRANT ALL ON public.feature_flag_overrides TO service_role;
ALTER TABLE public.feature_flag_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "flag overrides self read" ON public.feature_flag_overrides FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "flag overrides admin write" ON public.feature_flag_overrides FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed a couple flags so the surface is discoverable
INSERT INTO public.feature_flags (key, enabled, description) VALUES
  ('orchestrator.tools_v2', false, 'Route Copilot through the tool-using orchestrator loop'),
  ('research.company_v2', true, 'Use the McKinsey-grade Firecrawl + Perplexity + Gemini pipeline'),
  ('media.avif_variants', false, 'Generate AVIF variants for uploaded media assets')
ON CONFLICT (key) DO NOTHING;
