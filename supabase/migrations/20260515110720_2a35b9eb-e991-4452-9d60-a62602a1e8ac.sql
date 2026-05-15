
-- =====================================================================
-- SECURITY HARDENING MIGRATION
-- =====================================================================

-- ------------------------------------------------------------------
-- C1: WebAuthn credentials - remove public read, restrict to owner+admin
-- Lookup-by-email for login moves to the `webauthn-lookup` edge function.
-- ------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can lookup credentials for login" ON public.webauthn_credentials;

CREATE POLICY "Owners and admins can view credentials"
ON public.webauthn_credentials
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- ------------------------------------------------------------------
-- C3: Stop arbitrary UPDATEs on community_posts.
-- Likes_count is now maintained by a trigger on community_likes.
-- ------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update likes_count on any post" ON public.community_posts;

CREATE OR REPLACE FUNCTION public.sync_post_likes_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_posts
       SET likes_count = COALESCE(likes_count,0) + 1
     WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_posts
       SET likes_count = GREATEST(0, COALESCE(likes_count,0) - 1)
     WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_community_likes_count ON public.community_likes;
CREATE TRIGGER trg_community_likes_count
AFTER INSERT OR DELETE ON public.community_likes
FOR EACH ROW EXECUTE FUNCTION public.sync_post_likes_count();

-- Repair likes_count to current actual values
UPDATE public.community_posts p
   SET likes_count = COALESCE(c.cnt, 0)
  FROM (
    SELECT post_id, COUNT(*)::int AS cnt
      FROM public.community_likes
     GROUP BY post_id
  ) c
 WHERE p.id = c.post_id;

-- ------------------------------------------------------------------
-- C5/C6: Storage object ownership enforcement
-- Path convention: <user_id>/<filename>
-- ------------------------------------------------------------------
-- chat-attachments: tighten INSERT/UPDATE/DELETE to owner path
DROP POLICY IF EXISTS "Authenticated can upload chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own chat attachments" ON storage.objects;

CREATE POLICY "Chat attachments: owner can upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Chat attachments: owner can update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Chat attachments: owner can delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- certifications: owner-only writes
DROP POLICY IF EXISTS "Authenticated users can upload certifications" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own certifications" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own certifications" ON storage.objects;

CREATE POLICY "Certifications: owner can upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'certifications'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Certifications: owner can update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'certifications'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Certifications: owner can delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'certifications'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- job-images: owner-only writes/updates/deletes
DROP POLICY IF EXISTS "Authenticated can upload job images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update job images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete job images" ON storage.objects;

CREATE POLICY "Job images: owner can upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'job-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Job images: owner can update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'job-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Job images: owner can delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'job-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ------------------------------------------------------------------
-- C2/H1 foundation: public-safe views
-- Base tables remain unchanged for now to avoid breaking dependent
-- frontend code; future migration will tighten base SELECT policies
-- once frontend reads are migrated to these views.
-- ------------------------------------------------------------------
CREATE OR REPLACE VIEW public.profiles_public AS
SELECT id, name, avatar_url, is_online, created_at
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO authenticated, anon;

CREATE OR REPLACE VIEW public.worker_profiles_public AS
SELECT
  id, user_id, bio, skills, sub_skills, hourly_rate, daily_rate,
  years_experience, experience_level, service_area, county,
  constituency, ward, country, profile_photo_url, portfolio_urls,
  availability_days, availability_type, willing_to_travel,
  service_radius_km, max_travel_km, is_online, verification_status,
  first_name, last_name, gender, created_at, updated_at,
  -- coarse location: round to 2 decimals (~1km) to reduce precision exposure
  round(latitude::numeric, 2)::float8 AS latitude,
  round(longitude::numeric, 2)::float8 AS longitude
FROM public.worker_profiles;

GRANT SELECT ON public.worker_profiles_public TO authenticated, anon;

-- ------------------------------------------------------------------
-- M2: revoke EXECUTE from anon on sensitive helpers
-- ------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.get_super_admin_id() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_support_admin_id() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_pending_admin_promotion(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_exists() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_exists() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_super_admin_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;

-- ------------------------------------------------------------------
-- M7: tighten worker_work_history SELECT - hide reference contact info
-- via a public view; restrict raw table to owner + admin
-- ------------------------------------------------------------------
CREATE OR REPLACE VIEW public.worker_work_history_public AS
SELECT id, worker_id, role, company, start_date, end_date, description, created_at
FROM public.worker_work_history;

GRANT SELECT ON public.worker_work_history_public TO authenticated, anon;

DROP POLICY IF EXISTS "Work history viewable by authenticated" ON public.worker_work_history;
CREATE POLICY "Work history visible to owner and admins"
ON public.worker_work_history FOR SELECT TO authenticated
USING (auth.uid() = worker_id OR public.has_role(auth.uid(), 'admin'));

-- ------------------------------------------------------------------
-- L3: length limits on user-generated text to limit storage abuse
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_text_length()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'messages' AND NEW.content IS NOT NULL AND length(NEW.content) > 4000 THEN
    RAISE EXCEPTION 'Message too long (max 4000 chars)';
  ELSIF TG_TABLE_NAME = 'community_posts' AND NEW.content IS NOT NULL AND length(NEW.content) > 8000 THEN
    RAISE EXCEPTION 'Post too long (max 8000 chars)';
  ELSIF TG_TABLE_NAME = 'community_comments' AND NEW.content IS NOT NULL AND length(NEW.content) > 4000 THEN
    RAISE EXCEPTION 'Comment too long (max 4000 chars)';
  ELSIF TG_TABLE_NAME = 'complaints' AND NEW.message IS NOT NULL AND length(NEW.message) > 4000 THEN
    RAISE EXCEPTION 'Complaint too long (max 4000 chars)';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_messages_length ON public.messages;
CREATE TRIGGER trg_messages_length BEFORE INSERT OR UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.enforce_text_length();

DROP TRIGGER IF EXISTS trg_posts_length ON public.community_posts;
CREATE TRIGGER trg_posts_length BEFORE INSERT OR UPDATE ON public.community_posts
FOR EACH ROW EXECUTE FUNCTION public.enforce_text_length();

DROP TRIGGER IF EXISTS trg_comments_length ON public.community_comments;
CREATE TRIGGER trg_comments_length BEFORE INSERT OR UPDATE ON public.community_comments
FOR EACH ROW EXECUTE FUNCTION public.enforce_text_length();

DROP TRIGGER IF EXISTS trg_complaints_length ON public.complaints;
CREATE TRIGGER trg_complaints_length BEFORE INSERT OR UPDATE ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.enforce_text_length();
