CREATE TABLE IF NOT EXISTS public.token_blacklist (
  token_hash text PRIMARY KEY,
  user_id uuid,
  revoked_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires_at ON public.token_blacklist(expires_at);

GRANT ALL ON public.token_blacklist TO service_role;

ALTER TABLE public.token_blacklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No client access to token_blacklist"
ON public.token_blacklist
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);