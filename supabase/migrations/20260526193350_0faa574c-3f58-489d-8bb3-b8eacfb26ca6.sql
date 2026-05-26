
CREATE TABLE IF NOT EXISTS public.login_attempts (
  email text PRIMARY KEY,
  failed_count integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  last_attempt_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Service-role only. No grants to anon/authenticated; the edge function uses service role.
GRANT ALL ON public.login_attempts TO service_role;

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Deny-all policy for authenticated users (RLS enabled with no policies already denies, but be explicit).
CREATE POLICY "No client access to login_attempts"
ON public.login_attempts
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);
