CREATE OR REPLACE FUNCTION public.is_pending_admin_promotion(_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    JOIN public.user_roles r ON r.user_id = u.id
    WHERE lower(u.email) = lower(_email)
      AND r.role = 'admin'
      AND u.email_confirmed_at IS NULL
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_pending_admin_promotion(text) TO anon, authenticated;