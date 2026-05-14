CREATE OR REPLACE FUNCTION public.get_super_admin_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id
  FROM public.profiles p
  JOIN public.user_roles r ON r.user_id = p.id
  WHERE r.role = 'admin'
  ORDER BY p.created_at ASC, p.id ASC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND _user_id = public.get_super_admin_id()
$$;