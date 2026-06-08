
-- 1. Restrict direct reads on worker_profiles to owner + admin only
DROP POLICY IF EXISTS "Worker profiles viewable by authenticated" ON public.worker_profiles;

DROP POLICY IF EXISTS "Owner or admin can read worker profile" ON public.worker_profiles;
CREATE POLICY "Owner or admin can read worker profile"
  ON public.worker_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 2. Make the public view bypass RLS (run as owner) so non-owners can list fundis
ALTER VIEW public.worker_profiles_public SET (security_invoker = off);

-- 3. Grant read on the safe view to clients (signed-in and anon for QR verify page)
GRANT SELECT ON public.worker_profiles_public TO authenticated;
GRANT SELECT ON public.worker_profiles_public TO anon;
