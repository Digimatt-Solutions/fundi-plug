-- =====================================================================
-- Replace tight RLS with COLUMN-level grants so embedded joins keep
-- working while sensitive columns are hidden at the API layer.
-- =====================================================================

-- 1) Restore broad-readable RLS so embeds (profiles:user_id(name,...)) work
DROP POLICY IF EXISTS "Owner or admin can view profile" ON public.profiles;
DROP POLICY IF EXISTS "Owner or admin can view worker_profile" ON public.worker_profiles;

CREATE POLICY "Profiles viewable by authenticated"
  ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Worker profiles viewable by authenticated"
  ON public.worker_profiles FOR SELECT TO authenticated USING (true);

-- 2) Revoke the broad column SELECT grant, then GRANT only safe columns.
--    INSERT/UPDATE/DELETE grants are unaffected by REVOKE SELECT.
REVOKE SELECT ON public.profiles FROM authenticated, anon;
GRANT SELECT (id, name, avatar_url, is_online, is_active, created_at)
  ON public.profiles TO authenticated;
GRANT SELECT (id, name, avatar_url, is_online, created_at)
  ON public.profiles TO anon;

REVOKE SELECT ON public.worker_profiles FROM authenticated, anon;
GRANT SELECT (
  id, user_id, bio, hourly_rate, daily_rate, years_experience,
  skills, sub_skills, other_skill,
  service_area, county, constituency, ward, country,
  latitude, longitude,
  is_online, verification_status,
  profile_photo_url, first_name, middle_name, last_name,
  experience_level, service_radius_km, willing_to_travel, max_travel_km,
  availability_days, availability_type,
  gender, tools_owned, portfolio_urls,
  created_at, updated_at, submitted_for_review, rejection_reason,
  onboarding_step, onboarding_completed_at
) ON public.worker_profiles TO authenticated;

-- 3) Admin RPCs to retrieve full rows (incl. PII) for admin screens
CREATE OR REPLACE FUNCTION public.admin_list_profiles()
RETURNS SETOF public.profiles
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.* FROM public.profiles p WHERE public.has_role(auth.uid(), 'admin')
$$;

CREATE OR REPLACE FUNCTION public.admin_get_profile(_id uuid)
RETURNS SETOF public.profiles
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.* FROM public.profiles p
  WHERE p.id = _id AND public.has_role(auth.uid(), 'admin')
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_profiles() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_profiles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_profile(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_my_profile() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_job_contact(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;
GRANT  EXECUTE ON FUNCTION public.get_job_contact(uuid) TO authenticated;