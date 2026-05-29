UPDATE storage.buckets SET public = true WHERE id = 'community-images';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Community images are publicly accessible') THEN
    CREATE POLICY "Community images are publicly accessible"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'community-images');
  END IF;
END $$;