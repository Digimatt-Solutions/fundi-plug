DROP VIEW IF EXISTS public.profiles_public CASCADE;
DROP VIEW IF EXISTS public.worker_profiles_public CASCADE;

CREATE VIEW public.profiles_public
WITH (security_invoker = on) AS
SELECT id, name, avatar_url, is_online, is_active, created_at
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO authenticated, anon;

CREATE VIEW public.worker_profiles_public
WITH (security_invoker = on) AS
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