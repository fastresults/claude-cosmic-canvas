
-- ============================================================
-- Knowledge Base foundation
-- ============================================================

-- 1. knowledge_profiles ---------------------------------------
CREATE TABLE public.knowledge_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('personal','client','campaign')),
  parent_profile_id uuid REFERENCES public.knowledge_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX knowledge_profiles_user_idx ON public.knowledge_profiles(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_profiles TO authenticated;
GRANT ALL ON public.knowledge_profiles TO service_role;
ALTER TABLE public.knowledge_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profiles" ON public.knowledge_profiles
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER knowledge_profiles_set_updated_at
  BEFORE UPDATE ON public.knowledge_profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


-- 2. Extend knowledge_entries ---------------------------------
ALTER TABLE public.knowledge_entries
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.knowledge_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'paste'
    CHECK (source_type IN ('paste','url','upload','audio','voice_memo','linkedin','resume')),
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS use_in_next_gen boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS knowledge_entries_profile_idx ON public.knowledge_entries(profile_id);
CREATE INDEX IF NOT EXISTS knowledge_entries_user_pinned_idx
  ON public.knowledge_entries(user_id, pinned DESC, created_at DESC);


-- 3. knowledge_chunks -----------------------------------------
CREATE TABLE public.knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.knowledge_entries(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX knowledge_chunks_entry_idx ON public.knowledge_chunks(entry_id);
CREATE INDEX knowledge_chunks_user_idx ON public.knowledge_chunks(user_id);
CREATE INDEX knowledge_chunks_embedding_idx
  ON public.knowledge_chunks USING hnsw (embedding vector_cosine_ops);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_chunks TO authenticated;
GRANT ALL ON public.knowledge_chunks TO service_role;
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own chunks" ON public.knowledge_chunks
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- 4. knowledge_ingestion_jobs ---------------------------------
CREATE TABLE public.knowledge_ingestion_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_id uuid REFERENCES public.knowledge_entries(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','parsing','extracting','embedding','done','error')),
  stage_message text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX knowledge_jobs_user_idx ON public.knowledge_ingestion_jobs(user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_ingestion_jobs TO authenticated;
GRANT ALL ON public.knowledge_ingestion_jobs TO service_role;
ALTER TABLE public.knowledge_ingestion_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own jobs" ON public.knowledge_ingestion_jobs
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER knowledge_jobs_set_updated_at
  BEFORE UPDATE ON public.knowledge_ingestion_jobs
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.knowledge_ingestion_jobs;


-- 5. Retrieval function ---------------------------------------
CREATE OR REPLACE FUNCTION public.match_knowledge_chunks(
  p_user_id uuid,
  p_profile_ids uuid[],
  p_query vector(1536),
  p_match_count int DEFAULT 8,
  p_tag_filter text[] DEFAULT NULL
)
RETURNS TABLE (
  chunk_id uuid,
  entry_id uuid,
  entry_title text,
  source_type text,
  content text,
  similarity float
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id AS chunk_id,
    e.id AS entry_id,
    e.title AS entry_title,
    e.source_type,
    c.content,
    1 - (c.embedding <=> p_query) AS similarity
  FROM public.knowledge_chunks c
  JOIN public.knowledge_entries e ON e.id = c.entry_id
  WHERE c.user_id = p_user_id
    AND e.archived_at IS NULL
    AND (p_profile_ids IS NULL OR e.profile_id IS NULL OR e.profile_id = ANY(p_profile_ids))
    AND (p_tag_filter IS NULL OR e.tags && p_tag_filter)
    AND c.embedding IS NOT NULL
  ORDER BY c.embedding <=> p_query
  LIMIT p_match_count;
$$;
