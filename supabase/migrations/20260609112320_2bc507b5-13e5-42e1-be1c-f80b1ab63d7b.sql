
-- 1) Drop the existing view (and any dependent objects)
DROP VIEW IF EXISTS public.worker_profiles_public CASCADE;

-- 2) Create the physical table with only non-sensitive columns
CREATE TABLE public.worker_profiles_public (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  bio text,
  hourly_rate numeric,
  daily_rate numeric,
  years_experience integer,
  skills text[],
  sub_skills text[],
  other_skill text,
  service_area text,
  county text,
  constituency text,
  ward text,
  country text,
  latitude double precision,
  longitude double precision,
  is_online boolean,
  verification_status text,
  profile_photo_url text,
  first_name text,
  middle_name text,
  last_name text,
  experience_level text,
  service_radius_km numeric,
  willing_to_travel boolean,
  max_travel_km numeric,
  availability_days text[],
  availability_type text,
  gender text,
  tools_owned text[],
  portfolio_urls text[],
  submitted_for_review boolean,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wpp_verification_status ON public.worker_profiles_public(verification_status);
CREATE INDEX idx_wpp_is_online ON public.worker_profiles_public(is_online);
CREATE INDEX idx_wpp_county ON public.worker_profiles_public(county);
CREATE INDEX idx_wpp_skills ON public.worker_profiles_public USING gin(skills);

-- 3) Grants - authenticated only; writes happen through SECURITY DEFINER trigger
GRANT SELECT ON public.worker_profiles_public TO authenticated;
GRANT ALL    ON public.worker_profiles_public TO service_role;

-- 4) RLS
ALTER TABLE public.worker_profiles_public ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view approved fundis"
  ON public.worker_profiles_public
  FOR SELECT
  TO authenticated
  USING (verification_status = 'approved');

CREATE POLICY "Workers can view own public profile"
  ON public.worker_profiles_public
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all public profiles"
  ON public.worker_profiles_public
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 5) Sync trigger from worker_profiles -> worker_profiles_public
CREATE OR REPLACE FUNCTION public.sync_worker_profiles_public()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.worker_profiles_public WHERE id = OLD.id;
    RETURN OLD;
  END IF;

  INSERT INTO public.worker_profiles_public (
    id, user_id, bio, hourly_rate, daily_rate, years_experience,
    skills, sub_skills, other_skill, service_area, county, constituency, ward, country,
    latitude, longitude, is_online, verification_status, profile_photo_url,
    first_name, middle_name, last_name, experience_level, service_radius_km,
    willing_to_travel, max_travel_km, availability_days, availability_type, gender,
    tools_owned, portfolio_urls, submitted_for_review, rejection_reason,
    created_at, updated_at
  ) VALUES (
    NEW.id, NEW.user_id, NEW.bio, NEW.hourly_rate, NEW.daily_rate, NEW.years_experience,
    NEW.skills, NEW.sub_skills, NEW.other_skill, NEW.service_area, NEW.county, NEW.constituency, NEW.ward, NEW.country,
    NEW.latitude, NEW.longitude, NEW.is_online, NEW.verification_status::text, NEW.profile_photo_url,
    NEW.first_name, NEW.middle_name, NEW.last_name, NEW.experience_level, NEW.service_radius_km,
    NEW.willing_to_travel, NEW.max_travel_km, NEW.availability_days, NEW.availability_type, NEW.gender,
    NEW.tools_owned, NEW.portfolio_urls, NEW.submitted_for_review, NEW.rejection_reason,
    NEW.created_at, now()
  )
  ON CONFLICT (id) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    bio = EXCLUDED.bio,
    hourly_rate = EXCLUDED.hourly_rate,
    daily_rate = EXCLUDED.daily_rate,
    years_experience = EXCLUDED.years_experience,
    skills = EXCLUDED.skills,
    sub_skills = EXCLUDED.sub_skills,
    other_skill = EXCLUDED.other_skill,
    service_area = EXCLUDED.service_area,
    county = EXCLUDED.county,
    constituency = EXCLUDED.constituency,
    ward = EXCLUDED.ward,
    country = EXCLUDED.country,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    is_online = EXCLUDED.is_online,
    verification_status = EXCLUDED.verification_status,
    profile_photo_url = EXCLUDED.profile_photo_url,
    first_name = EXCLUDED.first_name,
    middle_name = EXCLUDED.middle_name,
    last_name = EXCLUDED.last_name,
    experience_level = EXCLUDED.experience_level,
    service_radius_km = EXCLUDED.service_radius_km,
    willing_to_travel = EXCLUDED.willing_to_travel,
    max_travel_km = EXCLUDED.max_travel_km,
    availability_days = EXCLUDED.availability_days,
    availability_type = EXCLUDED.availability_type,
    gender = EXCLUDED.gender,
    tools_owned = EXCLUDED.tools_owned,
    portfolio_urls = EXCLUDED.portfolio_urls,
    submitted_for_review = EXCLUDED.submitted_for_review,
    rejection_reason = EXCLUDED.rejection_reason,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_worker_profiles_public_ins ON public.worker_profiles;
DROP TRIGGER IF EXISTS trg_sync_worker_profiles_public_upd ON public.worker_profiles;
DROP TRIGGER IF EXISTS trg_sync_worker_profiles_public_del ON public.worker_profiles;

CREATE TRIGGER trg_sync_worker_profiles_public_ins
  AFTER INSERT ON public.worker_profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_worker_profiles_public();

CREATE TRIGGER trg_sync_worker_profiles_public_upd
  AFTER UPDATE ON public.worker_profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_worker_profiles_public();

CREATE TRIGGER trg_sync_worker_profiles_public_del
  AFTER DELETE ON public.worker_profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_worker_profiles_public();

-- 6) Backfill from existing worker_profiles
INSERT INTO public.worker_profiles_public (
  id, user_id, bio, hourly_rate, daily_rate, years_experience,
  skills, sub_skills, other_skill, service_area, county, constituency, ward, country,
  latitude, longitude, is_online, verification_status, profile_photo_url,
  first_name, middle_name, last_name, experience_level, service_radius_km,
  willing_to_travel, max_travel_km, availability_days, availability_type, gender,
  tools_owned, portfolio_urls, submitted_for_review, rejection_reason,
  created_at, updated_at
)
SELECT
  id, user_id, bio, hourly_rate, daily_rate, years_experience,
  skills, sub_skills, other_skill, service_area, county, constituency, ward, country,
  latitude, longitude, is_online, verification_status::text, profile_photo_url,
  first_name, middle_name, last_name, experience_level, service_radius_km,
  willing_to_travel, max_travel_km, availability_days, availability_type, gender,
  tools_owned, portfolio_urls, submitted_for_review, rejection_reason,
  created_at, now()
FROM public.worker_profiles
ON CONFLICT (id) DO NOTHING;
