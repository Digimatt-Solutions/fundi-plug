
-- 1. Add Final Price Lock columns to jobs
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS final_price NUMERIC,
  ADD COLUMN IF NOT EXISTS customer_price_confirmed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS worker_price_confirmed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS price_locked_at TIMESTAMPTZ;

-- 2. Trigger: lock price when both sides confirm; reset worker confirmation if price changes
CREATE OR REPLACE FUNCTION public.handle_price_lock()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- If customer changes the proposed final price after worker already confirmed, reset worker confirmation
  IF NEW.price_locked_at IS NULL
     AND OLD.final_price IS DISTINCT FROM NEW.final_price
     AND OLD.worker_price_confirmed = true THEN
    NEW.worker_price_confirmed = false;
  END IF;

  -- Lock as soon as both sides confirm
  IF NEW.customer_price_confirmed = true
     AND NEW.worker_price_confirmed = true
     AND NEW.price_locked_at IS NULL THEN
    NEW.price_locked_at = now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_price_lock ON public.jobs;
CREATE TRIGGER trg_handle_price_lock
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.handle_price_lock();

-- 3. Trigger: prevent assigning jobs to non-approved fundis
CREATE OR REPLACE FUNCTION public.enforce_fundi_approved_on_job()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
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

DROP TRIGGER IF EXISTS trg_enforce_fundi_approved_on_job ON public.jobs;
CREATE TRIGGER trg_enforce_fundi_approved_on_job
  BEFORE INSERT OR UPDATE OF worker_id ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_fundi_approved_on_job();

-- 4. Trigger: prevent unapproved fundis from applying to jobs
CREATE OR REPLACE FUNCTION public.enforce_applicant_approved()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
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

DROP TRIGGER IF EXISTS trg_enforce_applicant_approved ON public.job_applications;
CREATE TRIGGER trg_enforce_applicant_approved
  BEFORE INSERT ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION public.enforce_applicant_approved();
