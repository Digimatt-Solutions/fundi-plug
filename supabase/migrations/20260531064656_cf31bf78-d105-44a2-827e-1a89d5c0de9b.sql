
-- =========================================================
-- Worker can update own profile (defense around column-level PII grants)
-- =========================================================
CREATE OR REPLACE FUNCTION public.upsert_my_worker_profile(_patch jsonb)
RETURNS public.worker_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _existing public.worker_profiles;
  _merged public.worker_profiles;
  _result public.worker_profiles;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Ensure base row exists
  INSERT INTO public.worker_profiles (user_id) VALUES (_uid)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO _existing FROM public.worker_profiles WHERE user_id = _uid;

  -- Strip immutable / admin-only fields from caller patch
  _patch := COALESCE(_patch, '{}'::jsonb)
            - 'id' - 'user_id' - 'created_at' - 'updated_at'
            - 'onboarding_completed_at';

  _merged := jsonb_populate_record(_existing, to_jsonb(_existing) || _patch);

  UPDATE public.worker_profiles SET
    bio = _merged.bio,
    hourly_rate = _merged.hourly_rate,
    daily_rate = _merged.daily_rate,
    years_experience = _merged.years_experience,
    service_area = _merged.service_area,
    skills = _merged.skills,
    sub_skills = _merged.sub_skills,
    other_skill = _merged.other_skill,
    gender = _merged.gender,
    date_of_birth = _merged.date_of_birth,
    id_number = _merged.id_number,
    country = _merged.country,
    county = _merged.county,
    constituency = _merged.constituency,
    ward = _merged.ward,
    longitude = _merged.longitude,
    latitude = _merged.latitude,
    profile_photo_url = _merged.profile_photo_url,
    first_name = _merged.first_name,
    middle_name = _merged.middle_name,
    last_name = _merged.last_name,
    alt_phone = _merged.alt_phone,
    experience_level = _merged.experience_level,
    tools_owned = _merged.tools_owned,
    portfolio_urls = _merged.portfolio_urls,
    availability_days = _merged.availability_days,
    availability_type = _merged.availability_type,
    exact_address = _merged.exact_address,
    landmark = _merged.landmark,
    willing_to_travel = _merged.willing_to_travel,
    max_travel_km = _merged.max_travel_km,
    service_radius_km = _merged.service_radius_km,
    kra_pin = _merged.kra_pin,
    nca_number = _merged.nca_number,
    mpesa_number = _merged.mpesa_number,
    mpesa_name = _merged.mpesa_name,
    bank_name = _merged.bank_name,
    bank_account = _merged.bank_account,
    consent_data_usage = _merged.consent_data_usage,
    consent_background_check = _merged.consent_background_check,
    consented_at = _merged.consented_at,
    onboarding_step = _merged.onboarding_step,
    submitted_for_review = _merged.submitted_for_review,
    verification_status = _merged.verification_status,
    next_of_kin_name = _merged.next_of_kin_name,
    next_of_kin_relationship = _merged.next_of_kin_relationship,
    next_of_kin_phone = _merged.next_of_kin_phone,
    selfie_with_id_url = _merged.selfie_with_id_url,
    id_front_url = _merged.id_front_url,
    id_back_url = _merged.id_back_url,
    good_conduct_url = _merged.good_conduct_url,
    other_licenses = _merged.other_licenses,
    is_online = _merged.is_online,
    updated_at = now()
  WHERE user_id = _uid
  RETURNING * INTO _result;

  RETURN _result;
END
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_my_worker_profile(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_my_worker_profile(jsonb) TO authenticated;

-- =========================================================
-- Supplier can update own business profile
-- =========================================================
CREATE OR REPLACE FUNCTION public.upsert_my_business_profile(_patch jsonb)
RETURNS public.business_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _existing public.business_profiles;
  _merged public.business_profiles;
  _result public.business_profiles;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.business_profiles (user_id) VALUES (_uid)
  ON CONFLICT DO NOTHING;

  SELECT * INTO _existing FROM public.business_profiles WHERE user_id = _uid;

  IF _existing.id IS NULL THEN
    INSERT INTO public.business_profiles (user_id, business_name)
    VALUES (_uid, COALESCE(_patch->>'business_name', ''))
    RETURNING * INTO _existing;
  END IF;

  _patch := COALESCE(_patch, '{}'::jsonb)
            - 'id' - 'user_id' - 'created_at' - 'updated_at'
            - 'approved_by' - 'approved_at';

  _merged := jsonb_populate_record(_existing, to_jsonb(_existing) || _patch);

  UPDATE public.business_profiles SET
    business_name = _merged.business_name,
    description = _merged.description,
    category = _merged.category,
    category_other = _merged.category_other,
    logo_url = _merged.logo_url,
    banner_url = _merged.banner_url,
    county = _merged.county,
    town = _merged.town,
    physical_address = _merged.physical_address,
    latitude = _merged.latitude,
    longitude = _merged.longitude,
    website = _merged.website,
    business_phone = _merged.business_phone,
    business_email = _merged.business_email,
    years_in_operation = _merged.years_in_operation,
    registration_number = _merged.registration_number,
    kra_pin = _merged.kra_pin,
    verification_status = _merged.verification_status,
    submitted_at = _merged.submitted_at,
    rejection_reason = _merged.rejection_reason,
    updated_at = now()
  WHERE id = _existing.id
  RETURNING * INTO _result;

  RETURN _result;
END
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_my_business_profile(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_my_business_profile(jsonb) TO authenticated;
