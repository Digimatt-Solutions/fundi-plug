CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _role app_role;
  _name TEXT;
  _requested_role app_role;
BEGIN
  _name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  _requested_role := COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'customer');

  -- Only allow admin role if explicitly set via service-role flag in metadata.
  -- Public signups can never become admin, regardless of how many users exist.
  IF _requested_role = 'admin' AND COALESCE((NEW.raw_user_meta_data->>'is_setup_admin')::boolean, false) = true THEN
    _role := 'admin';
  ELSIF _requested_role = 'worker' THEN
    _role := 'worker';
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

-- Public RPC to check whether an admin already exists. Safe to expose: returns only a boolean.
CREATE OR REPLACE FUNCTION public.admin_exists()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin')
$function$;

GRANT EXECUTE ON FUNCTION public.admin_exists() TO anon, authenticated;