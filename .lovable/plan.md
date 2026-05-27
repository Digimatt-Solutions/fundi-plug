# Security & UX Hardening Plan

## 1. Lockout messaging & auto-restoration

The `secure-login` edge function already:
- Returns a friendly "Account temporarily locked … try again in N hour(s)" message
- Returns "Invalid email or password. N attempts remaining before lockout" on each failure
- Auto-restores access because it checks `locked_until > now()` — expired locks are ignored

What's missing on the **frontend** is the message being shown in a clear, sustained way. Today it's set into `error` state and toasted with a generic title "Sign in problem".

**Changes (frontend only):**
- `AuthContext.login` — return the raw server error verbatim (don't double-wrap), and forward `locked` + `locked_until` so the page can render a countdown.
- `Auth.tsx`
  - Show the lockout banner in a distinct warning style (amber) with the exact remaining time updated every second.
  - Show "N attempts remaining" inline under the password field after each failure, not just in the top error banner.
  - Use a focused toast title ("Account locked" / "Wrong password") matching the case.

## 2. Private-bucket images

All 10 buckets are now private. Newly-uploaded files store a 1-year signed URL, and `useSignedUrl` / `AssetImage` re-sign on render. The risk is `<img src={dbValue}>` in components that haven't been migrated — those break for legacy `/object/public/...` rows or bare paths.

**Changes:** Migrate every `<img src={…fromDB}>` to `<AssetImage src={…} bucket="…" />` for these surfaces (the ones referencing storage-backed columns):

- `WorkerReviewsPage.tsx` — reviewer avatars (`avatars`)
- `AdminBusinessVerificationsPage.tsx` — logo/banner (`business-assets`)
- `WorkerMyJobsPage.tsx` — job images (`job-images`)
- `CommunityPage.tsx` — post and blog images (`community-images`)
- `VerificationPage.tsx` — profile photo / ID docs (`avatars`, `verification-docs`)
- `UserManagementPage.tsx` — user avatars (`avatars`)
- `PublicReviewsPage.tsx` — worker + reviewer avatars (`avatars`)
- `ChatPage.tsx` — peer avatar (`avatars`)
- `FindWorkersPage.tsx` — worker avatar (`avatars`)
- `CustomerBookingsPage.tsx` — worker thumbnail (`avatars`)
- `AdminJobsPage.tsx` — job image (`job-images`)

Hard-coded asset imports (`heroImage`, `logo`, `mpesaLogo` …) stay as plain `<img>` — they're bundled assets, not storage.

## 3. Refresh token rotation

Lovable Cloud / Supabase Auth already issues a **new refresh token on every refresh** and revokes the prior one (rotation is on by default with `refresh_token_rotation_enabled = true` and a short reuse window). I'll confirm via `configure_auth` and explicitly set `refresh_token_reuse_interval = 0` so the previous token is rejected immediately. No app code change required.

## 4. Token blacklist

**Schema:** new `public.token_blacklist` table
- `token_hash text primary key` (SHA-256 of the JWT)
- `user_id uuid`
- `revoked_at timestamptz default now()`
- `expires_at timestamptz` — set to the JWT `exp` claim, so a daily cleanup keeps the table small
- RLS: no client access; service-role only
- Index on `expires_at` for cleanup

**Logout flow** (`AuthContext.logout`):
1. Read current session access_token + refresh_token.
2. Call new edge function `revoke-token` which hashes both and inserts into `token_blacklist`, then calls `auth.admin.signOut(userId, 'global')` to invalidate refresh tokens server-side.
3. Then `supabase.auth.signOut()` locally.

**Check on every request:**
A truly universal check requires intercepting every Supabase REST/RPC call. That's not practical in the browser SDK. Realistic coverage:
- **All our edge functions** get a shared `assertTokenNotRevoked(req)` helper (new `supabase/functions/_shared/auth.ts`) that hashes the bearer and checks `token_blacklist`. Returns 401 if revoked.
- Wire the helper into every existing function that already validates a JWT: `flush-data`, `admin-manage-user`, `restore-backup`, `setup-admin`, `webauthn-lookup`, `reset-password-with-otp`, `verify-otp`, `send-otp`, `create-payment`, `paystack-initiate-payment`, `paystack-verify-payment`, `verify-payment`, `mpesa-stk-push`.
- Direct `supabase-js` queries from the browser are protected by RLS + the global signOut (refresh stops working), so a revoked access token dies at its natural `exp` (1 hour) — acceptable given the rotation + global-signout combo.

I'll be explicit with the user about this scope: blacklist is enforced at the edge-function boundary; SDK calls rely on the 1-hour access-token TTL + forced global refresh-token revocation.

## Technical details

- Edge functions use `crypto.subtle.digest('SHA-256', …)` for hashing — no extra deps.
- `revoke-token` runs with `verify_jwt = false` because the client may be calling it with an already-stale token; it derives the user from the JWT payload itself.
- Daily cleanup: cron-style isn't set up; instead the check ignores rows where `expires_at < now()`, and we add a `delete` on insert collisions to keep the table small.
- Migration order: create table → grants (service_role only) → enable RLS → deny-all policy.

## Files touched

**New**
- `supabase/migrations/<ts>_token_blacklist.sql`
- `supabase/functions/revoke-token/index.ts`
- `supabase/functions/_shared/auth.ts`

**Edited**
- `src/contexts/AuthContext.tsx` (login error forwarding, logout revoke)
- `src/pages/Auth.tsx` (lockout banner + countdown + per-field error)
- `supabase/config.toml` (add `[functions.revoke-token] verify_jwt = false`)
- ~11 page components migrating `<img>` → `<AssetImage>`
- ~13 edge functions adding the blacklist check
