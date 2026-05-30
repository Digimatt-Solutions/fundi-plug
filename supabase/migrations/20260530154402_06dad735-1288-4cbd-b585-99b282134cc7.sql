
-- =========================================================
-- WORKER_PROFILES: column-level PII hardening
-- =========================================================
REVOKE SELECT ON public.worker_profiles FROM authenticated;

-- Grant SELECT only on non-sensitive (publicly viewable to other authenticated users) columns
GRANT SELECT (
  id, user_id, bio, years_experience, skills, sub_skills,
  service_area, county, country, hourly_rate, daily_rate,
  latitude, longitude, is_online, verification_status,
  profile_photo_url, first_name, middle_name, last_name,
  experience_level, service_radius_km, willing_to_travel, max_travel_km,
  availability_days, availability_type, constituency, ward,
  landmark, exact_address, tools_owned, portfolio_urls, other_skill,
  gender, onboarding_step, onboarding_completed_at, submitted_for_review,
  created_at, updated_at
) ON public.worker_profiles TO authenticated;

-- Owners and admins still need INSERT/UPDATE on the full row (subject to RLS)
GRANT INSERT, UPDATE, DELETE ON public.worker_profiles TO authenticated;
GRANT ALL ON public.worker_profiles TO service_role;

-- Owner-only secure read of full row
CREATE OR REPLACE FUNCTION public.get_my_worker_profile()
RETURNS SETOF public.worker_profiles
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.worker_profiles WHERE user_id = auth.uid()
$$;

-- Admin-only secure list of full rows
CREATE OR REPLACE FUNCTION public.admin_list_worker_profiles()
RETURNS SETOF public.worker_profiles
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT wp.* FROM public.worker_profiles wp
  WHERE public.has_role(auth.uid(), 'admin')
$$;

-- Admin-only secure single read
CREATE OR REPLACE FUNCTION public.admin_get_worker_profile(_user_id uuid)
RETURNS SETOF public.worker_profiles
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.worker_profiles
  WHERE user_id = _user_id AND public.has_role(auth.uid(), 'admin')
$$;

GRANT EXECUTE ON FUNCTION public.get_my_worker_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_worker_profiles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_worker_profile(uuid) TO authenticated;

-- =========================================================
-- BUSINESS_PROFILES: column-level PII hardening
-- =========================================================
REVOKE SELECT ON public.business_profiles FROM authenticated;

GRANT SELECT (
  id, user_id, business_name, logo_url, banner_url, description,
  category, category_other, county, town, physical_address,
  latitude, longitude, website, business_phone, business_email,
  years_in_operation, verification_status, submitted_at,
  approved_at, approved_by, rejection_reason, created_at, updated_at
) ON public.business_profiles TO authenticated;

GRANT INSERT, UPDATE, DELETE ON public.business_profiles TO authenticated;
GRANT ALL ON public.business_profiles TO service_role;

CREATE OR REPLACE FUNCTION public.get_my_business_profile()
RETURNS SETOF public.business_profiles
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.business_profiles WHERE user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.admin_list_business_profiles()
RETURNS SETOF public.business_profiles
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.business_profiles
  WHERE public.has_role(auth.uid(), 'admin')
  ORDER BY submitted_at DESC NULLS LAST
$$;

CREATE OR REPLACE FUNCTION public.admin_get_business_profile(_id uuid)
RETURNS SETOF public.business_profiles
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.business_profiles
  WHERE id = _id AND public.has_role(auth.uid(), 'admin')
$$;

GRANT EXECUTE ON FUNCTION public.get_my_business_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_business_profiles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_business_profile(uuid) TO authenticated;
