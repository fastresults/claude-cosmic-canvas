
UPDATE public.create_drafts
SET title = 'Untitled — please rename'
WHERE title IS NULL OR btrim(title) = '';

ALTER TABLE public.create_drafts
  ALTER COLUMN title SET NOT NULL,
  ADD CONSTRAINT create_drafts_title_not_blank CHECK (length(btrim(title)) > 0);
