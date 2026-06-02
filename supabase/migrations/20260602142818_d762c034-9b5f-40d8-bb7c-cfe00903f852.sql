-- =====================================================================
-- Lock down PII on profiles + worker_profiles, expose safe public views
-- =====================================================================

-- 1) Drop the over-permissive SELECT policies
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;
DROP POLICY IF EXISTS "Worker profiles viewable by authenticated" ON public.worker_profiles;

-- 2) New tight SELECT policies: owner or admin only on the base tables
CREATE POLICY "Owner or admin can view profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owner or admin can view worker_profile"
  ON public.worker_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 3) Safe public view of profiles (no email/phone/lat/long)
DROP VIEW IF EXISTS public.profiles_public CASCADE;
CREATE VIEW public.profiles_public
WITH (security_invoker = off) AS
SELECT id, name, avatar_url, is_online, is_active, created_at
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO authenticated, anon;

-- 4) Safe public view of worker_profiles (no ID/KRA/bank/dob/next-of-kin/etc.)
DROP VIEW IF EXISTS public.worker_profiles_public CASCADE;
CREATE VIEW public.worker_profiles_public
WITH (security_invoker = off) AS
SELECT
  id, user_id, bio, hourly_rate, daily_rate, years_experience,
  skills, sub_skills, other_skill,
  service_area, county, constituency, ward, country,
  latitude, longitude,
  is_online, verification_status,
  profile_photo_url, first_name, middle_name, last_name,
  experience_level, service_radius_km, willing_to_travel, max_travel_km,
  availability_days, availability_type,
  gender, tools_owned, portfolio_urls,
  created_at, submitted_for_review, rejection_reason
FROM public.worker_profiles;

GRANT SELECT ON public.worker_profiles_public TO authenticated, anon;

-- 5) Owner-facing RPC for full own profile (incl. email/phone/location)
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS SETOF public.profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.profiles WHERE id = auth.uid()
$$;

-- 6) Contact lookup limited to admins or fellow job participants
CREATE OR REPLACE FUNCTION public.get_job_contact(_user_id uuid)
RETURNS TABLE (id uuid, name text, email text, phone text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.name, p.email, p.phone, p.avatar_url
  FROM public.profiles p
  WHERE p.id = _user_id
    AND (
      public.has_role(auth.uid(), 'admin')
      OR auth.uid() = _user_id
      OR EXISTS (
        SELECT 1 FROM public.jobs j
        WHERE ((j.customer_id = auth.uid() AND j.worker_id = _user_id)
            OR (j.worker_id   = auth.uid() AND j.customer_id = _user_id))
      )
    )
$$;

GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_job_contact(uuid) TO authenticated;