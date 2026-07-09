UPDATE public.system_voices
SET name = 'Like ' || name
WHERE name NOT LIKE 'Like %';