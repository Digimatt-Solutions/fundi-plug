
CREATE OR REPLACE FUNCTION public.enforce_fundi_approved_on_job()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _status text;
BEGIN
  IF NEW.worker_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.worker_id IS DISTINCT FROM OLD.worker_id) THEN
    SELECT verification_status::text INTO _status
      FROM public.worker_profiles
     WHERE user_id = NEW.worker_id;
    IF _status IS DISTINCT FROM 'approved' THEN
      RAISE EXCEPTION 'This fundi is not yet approved and cannot be assigned to jobs.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_applicant_approved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _status text;
BEGIN
  SELECT verification_status::text INTO _status
    FROM public.worker_profiles
   WHERE user_id = NEW.worker_id;
  IF _status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'Only approved fundis can apply to jobs. Please complete verification first.';
  END IF;
  RETURN NEW;
END;
$$;
