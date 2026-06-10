
-- MODULE_SETTINGS: admin-only
DROP POLICY IF EXISTS "Anyone authenticated can view module settings" ON public.module_settings;
DROP POLICY IF EXISTS "Admins can manage module settings" ON public.module_settings;

CREATE POLICY "Admins can view module settings" ON public.module_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage module settings" ON public.module_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Helper: sidebar / non-admin clients read their own role's enabled modules through this SECURITY DEFINER fn
CREATE OR REPLACE FUNCTION public.get_enabled_modules(_role text)
RETURNS TABLE(module_key text, enabled boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT module_key, enabled
  FROM public.module_settings
  WHERE role = _role
$$;

GRANT EXECUTE ON FUNCTION public.get_enabled_modules(text) TO authenticated;

-- PROFILES: own-or-admin SELECT; admin full manage; keep own insert/update
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;

CREATE POLICY "Users can view own profile or admin all"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all profiles"
  ON public.profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Safe directory view (non-sensitive fields only) for cross-user name/avatar lookups
CREATE OR REPLACE VIEW public.profiles_basic
WITH (security_invoker = off) AS
  SELECT id, name, avatar_url, is_online
  FROM public.profiles;

GRANT SELECT ON public.profiles_basic TO authenticated, anon;
