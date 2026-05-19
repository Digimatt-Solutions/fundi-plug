-- 1. Add the new enum value
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'supplier';

-- 2. Update signup handler to allow 'supplier' as a requested role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _role app_role;
  _name TEXT;
  _requested_role_text TEXT;
BEGIN
  _name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  _requested_role_text := COALESCE(NEW.raw_user_meta_data->>'role', 'customer');

  IF _requested_role_text = 'admin' AND COALESCE((NEW.raw_user_meta_data->>'is_setup_admin')::boolean, false) = true THEN
    _role := 'admin';
  ELSIF _requested_role_text = 'worker' THEN
    _role := 'worker';
  ELSIF _requested_role_text = 'supplier' THEN
    _role := 'supplier';
  ELSE
    _role := 'customer';
  END IF;

  INSERT INTO public.profiles (id, email, name, phone) VALUES (NEW.id, NEW.email, _name, NEW.raw_user_meta_data->>'phone');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role);
  IF _role = 'worker' THEN
    INSERT INTO public.worker_profiles (user_id) VALUES (NEW.id);
  END IF;
  INSERT INTO public.activity_logs (user_id, action, detail, entity_type, entity_id)
    VALUES (NEW.id, 'User Registered', 'Signed up as ' || _role::text, 'user', NEW.id);
  RETURN NEW;
END;
$function$;