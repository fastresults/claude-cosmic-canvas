
-- Build mapping: dup id -> canonical (oldest) id per (user_id, lower(trim(name)))
WITH ranked AS (
  SELECT id, user_id, lower(trim(name)) AS norm_name,
         FIRST_VALUE(id) OVER (PARTITION BY user_id, lower(trim(name)) ORDER BY created_at ASC, id ASC) AS canonical_id
  FROM public.voice_profiles
),
dupes AS (
  SELECT id AS dup_id, canonical_id FROM ranked WHERE id <> canonical_id
)
-- Repoint profiles.active_voice_id
UPDATE public.profiles p
SET active_voice_id = d.canonical_id
FROM dupes d
WHERE p.active_voice_id = d.dup_id;

WITH ranked AS (
  SELECT id, user_id,
         FIRST_VALUE(id) OVER (PARTITION BY user_id, lower(trim(name)) ORDER BY created_at ASC, id ASC) AS canonical_id
  FROM public.voice_profiles
),
dupes AS (
  SELECT id AS dup_id, canonical_id FROM ranked WHERE id <> canonical_id
)
UPDATE public.default_profiles dp
SET voice_id = d.canonical_id
FROM dupes d
WHERE dp.voice_id = d.dup_id;

WITH ranked AS (
  SELECT id, user_id,
         FIRST_VALUE(id) OVER (PARTITION BY user_id, lower(trim(name)) ORDER BY created_at ASC, id ASC) AS canonical_id
  FROM public.voice_profiles
),
dupes AS (
  SELECT id AS dup_id, canonical_id FROM ranked WHERE id <> canonical_id
)
UPDATE public.voice_signals vs
SET voice_profile_id = d.canonical_id
FROM dupes d
WHERE vs.voice_profile_id = d.dup_id;

-- Delete the duplicate voice rows (keep oldest)
WITH ranked AS (
  SELECT id,
         FIRST_VALUE(id) OVER (PARTITION BY user_id, lower(trim(name)) ORDER BY created_at ASC, id ASC) AS canonical_id
  FROM public.voice_profiles
)
DELETE FROM public.voice_profiles vp
USING ranked r
WHERE vp.id = r.id AND r.id <> r.canonical_id;

-- Enforce uniqueness going forward
CREATE UNIQUE INDEX IF NOT EXISTS voice_profiles_user_name_uidx
  ON public.voice_profiles (user_id, lower(trim(name)));
