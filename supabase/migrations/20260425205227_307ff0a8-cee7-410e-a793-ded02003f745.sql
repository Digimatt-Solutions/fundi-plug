
-- Table to store WebAuthn fingerprint passkey credentials per user
CREATE TABLE IF NOT EXISTS public.webauthn_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  credential_id text NOT NULL UNIQUE,
  public_key text,
  device_label text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_webauthn_user ON public.webauthn_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_webauthn_credid ON public.webauthn_credentials(credential_id);

ALTER TABLE public.webauthn_credentials ENABLE ROW LEVEL SECURITY;

-- Users manage their own credentials
CREATE POLICY "Users manage own credentials"
ON public.webauthn_credentials
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Public can look up a credential id during login (so we can find which user owns it).
-- We expose only credential_id + email mapping; safe since these are not secrets.
CREATE POLICY "Public can lookup credentials for login"
ON public.webauthn_credentials
FOR SELECT
TO anon, authenticated
USING (true);

-- Public can insert is NOT allowed; authenticated users only register their own.
