
-- Drop existing FKs pointing to auth.users and recreate pointing to profiles
ALTER TABLE public.jobs DROP CONSTRAINT jobs_customer_id_fkey;
ALTER TABLE public.jobs DROP CONSTRAINT jobs_worker_id_fkey;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.profiles(id);
ALTER TABLE public.jobs ADD CONSTRAINT jobs_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.profiles(id);

ALTER TABLE public.reviews DROP CONSTRAINT reviews_reviewer_id_fkey;
ALTER TABLE public.reviews DROP CONSTRAINT reviews_reviewee_id_fkey;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.profiles(id);
ALTER TABLE public.reviews ADD CONSTRAINT reviews_reviewee_id_fkey FOREIGN KEY (reviewee_id) REFERENCES public.profiles(id);

ALTER TABLE public.bookings DROP CONSTRAINT bookings_customer_id_fkey;
ALTER TABLE public.bookings DROP CONSTRAINT bookings_worker_id_fkey;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.profiles(id);
ALTER TABLE public.bookings ADD CONSTRAINT bookings_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.profiles(id);

ALTER TABLE public.payments DROP CONSTRAINT payments_payer_id_fkey;
ALTER TABLE public.payments DROP CONSTRAINT payments_payee_id_fkey;
ALTER TABLE public.payments ADD CONSTRAINT payments_payer_id_fkey FOREIGN KEY (payer_id) REFERENCES public.profiles(id);
ALTER TABLE public.payments ADD CONSTRAINT payments_payee_id_fkey FOREIGN KEY (payee_id) REFERENCES public.profiles(id);

ALTER TABLE public.job_applications ADD CONSTRAINT job_applications_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.profiles(id);

ALTER TABLE public.activity_logs DROP CONSTRAINT activity_logs_user_id_fkey;
ALTER TABLE public.activity_logs ADD CONSTRAINT activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);

ALTER TABLE public.worker_profiles DROP CONSTRAINT worker_profiles_user_id_fkey;
ALTER TABLE public.worker_profiles ADD CONSTRAINT worker_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Also update handle_new_user to log logins
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _role app_role;
  _name TEXT;
  _user_count INTEGER;
BEGIN
  _name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  _role := COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'customer');
  SELECT COUNT(*) INTO _user_count FROM public.profiles;
  IF _user_count = 0 THEN _role := 'admin'; END IF;
  INSERT INTO public.profiles (id, email, name, phone) VALUES (NEW.id, NEW.email, _name, NEW.raw_user_meta_data->>'phone');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role);
  IF _role = 'worker' THEN INSERT INTO public.worker_profiles (user_id) VALUES (NEW.id); END IF;
  INSERT INTO public.activity_logs (user_id, action, detail, entity_type, entity_id) VALUES (NEW.id, 'User Registered', 'Signed up as ' || _role::text, 'user', NEW.id);
  RETURN NEW;
END;
$function$;

-- Create a function to log sign-ins
CREATE OR REPLACE FUNCTION public.handle_user_login()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at THEN
    INSERT INTO public.activity_logs (user_id, action, detail, entity_type, entity_id)
    VALUES (NEW.id, 'User Login', 'User signed in', 'user', NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;
