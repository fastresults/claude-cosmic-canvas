
-- Backfill legacy drafts -> create_drafts (preserve ids)
INSERT INTO public.create_drafts (
  id, user_id, format_id, title, sections, status, archived,
  quality_score, campaign_id, created_at, updated_at
)
SELECT
  d.id,
  d.user_id,
  COALESCE(d.format, 'post') AS format_id,
  NULL::text AS title,
  jsonb_build_array(jsonb_build_object('heading', NULL, 'body', COALESCE(d.body, ''))) AS sections,
  COALESCE(d.status, 'draft') AS status,
  (COALESCE(d.status,'') = 'archived') AS archived,
  NULLIF((d.score->>'total'), '')::numeric AS quality_score,
  d.campaign_id,
  d.created_at,
  d.updated_at
FROM public.drafts d
WHERE NOT EXISTS (SELECT 1 FROM public.create_drafts cd WHERE cd.id = d.id);

-- Backfill legacy image_url as a cover image row
INSERT INTO public.create_media (
  draft_id, user_id, url, role, generated_by, sort_order
)
SELECT
  d.id, d.user_id, d.image_url, 'cover', 'upload', 0
FROM public.drafts d
WHERE d.image_url IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.create_drafts cd WHERE cd.id = d.id)
  AND NOT EXISTS (
    SELECT 1 FROM public.create_media m
    WHERE m.draft_id = d.id AND m.url = d.image_url
  );
