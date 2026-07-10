
DO $$ BEGIN
  CREATE POLICY "draft-media owner select" ON storage.objects FOR SELECT
    USING (bucket_id = 'draft-media' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "draft-media owner insert" ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'draft-media' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "draft-media owner update" ON storage.objects FOR UPDATE
    USING (bucket_id = 'draft-media' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "draft-media owner delete" ON storage.objects FOR DELETE
    USING (bucket_id = 'draft-media' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
