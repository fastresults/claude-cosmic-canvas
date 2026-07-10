
DROP FUNCTION IF EXISTS public.match_knowledge_chunks(uuid, uuid[], vector, int, text[]);

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
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    c.id, e.id, e.title, e.source_type, c.content,
    1 - (c.embedding <=> p_query)
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

REVOKE ALL ON FUNCTION public.match_knowledge_chunks(uuid, uuid[], vector, int, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_knowledge_chunks(uuid, uuid[], vector, int, text[]) TO authenticated, service_role;
