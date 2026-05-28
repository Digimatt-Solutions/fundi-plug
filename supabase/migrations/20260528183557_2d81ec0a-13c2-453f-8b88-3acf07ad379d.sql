
-- 1. Make avatars bucket public
UPDATE storage.buckets SET public = true WHERE id = 'avatars';

-- Ensure public read policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Public read access to avatars'
  ) THEN
    CREATE POLICY "Public read access to avatars"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'avatars');
  END IF;
END$$;

-- 2. Block email changes on profiles unless service_role
CREATE OR REPLACE FUNCTION public.prevent_profile_email_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    IF current_setting('request.jwt.claim.role', true) <> 'service_role' THEN
      RAISE EXCEPTION 'Email changes require admin approval. Contact support.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_block_email_change ON public.profiles;
CREATE TRIGGER profiles_block_email_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_email_change();
