
# Security Audit - Findings & Remediation Plan

Scope: Supabase backend (RLS, storage, functions), edge functions in `supabase/functions/*`, and the React frontend. Findings are derived from the project security scanner, Supabase linter, and a code review of authentication, role checks, and data exposure.

---

## CRITICAL

### C1. WebAuthn credentials publicly readable (anon + authenticated)
- Where: `webauthn_credentials` table, policy "Public can lookup credentials for login" with `USING (true)` for `{anon, authenticated}`.
- Risk: Exposes `credential_id`, `public_key`, `email`, `user_id`, `device_label` of every user to the entire internet. Enables user enumeration and targeted phishing; weakens passkey UX guarantees.
- Fix: Remove the public SELECT policy. Move credential lookup behind an edge function (service role) that returns only the minimum fields needed for the WebAuthn ceremony for a given email. Restrict direct row access to `auth.uid() = user_id` and admins.

### C2. Sensitive PII on `worker_profiles` readable by every authenticated user
- Where: policy "Worker profiles viewable by authenticated" `USING (true)`.
- Exposed columns include `id_number`, `date_of_birth`, `kra_pin`, `nca_number`, `bank_account`, `bank_name`, `mpesa_number`, `mpesa_name`, `alt_phone`, next-of-kin fields, ID document URLs, and precise GPS.
- Fix: Split the table or use a public view. Keep a public-safe view (`bio`, `skills`, `hourly_rate`, `service_area`, coarse location, `is_online`, ratings) readable by authenticated users. Restrict the base table SELECT to `auth.uid() = user_id OR has_role(auth.uid(),'admin')`. Update frontend to query the view.

### C3. Anyone can overwrite any community post
- Where: `community_posts` policy "Users can update likes_count on any post" `USING (true) WITH CHECK (true)` allows updates to ALL columns, not just `likes_count`.
- Fix: Drop that policy. Implement likes via the existing `community_likes` table and recompute `likes_count` server-side, either via a trigger on `community_likes` insert/delete, or via a `SECURITY DEFINER` function `increment_post_like(post_id)` that only mutates `likes_count`. Keep the author-scoped UPDATE policy for content edits.

### C4. Realtime channel authorization missing
- Where: No `realtime.messages` RLS policies. Tables published: `messages`, `jobs`, `job_applications`, `activity_logs`, `worker_profiles`.
- Risk: Any signed-in user can subscribe to any topic and receive private chat messages, bids, and audit events.
- Fix: Add `realtime.messages` RLS policies that constrain `topic` to channels owned by `auth.uid()`. Remove `activity_logs` and `worker_profiles` from the realtime publication unless strictly required. For `messages`, set topic to `dm:<sorted-uid-pair>` and authorize both participants only.

### C5. Chat attachments bucket is public
- Where: `chat-attachments` bucket public + SELECT policy with no path check; INSERT also lacks ownership check.
- Risk: Anyone with a URL (or who guesses one) can read private DM media; any user can write to any path.
- Fix: Set bucket to private. Serve via short-lived signed URLs created by an edge function that verifies the caller is the message sender or recipient. Restrict INSERT to `(storage.foldername(name))[1] = auth.uid()::text`.

### C6. Storage write/ownership gaps on `certifications` and `job-images`
- Where: INSERT/UPDATE/DELETE policies check only `bucket_id`.
- Risk: Any authenticated user can upload, overwrite, or delete files for any worker/job, enabling impersonation, fraud (fake certs), or destruction of evidence.
- Fix: Enforce path ownership on all three operations: `(storage.foldername(name))[1] = auth.uid()::text`. For `job-images`, also validate via an edge function that the user owns the linked `jobs.id` referenced in the path.

---

## HIGH

### H1. Email and phone of every user readable by any signed-in user
- Where: `profiles` policy "Profiles viewable by authenticated" `USING (true)`.
- Fix: Create a public view exposing only `id, name, avatar_url, is_online`. Restrict base-table SELECT to `auth.uid() = id OR has_role(auth.uid(),'admin')`. Update queries (`AuthContext`, chat lists, fundi search) to use the view.

### H2. Leaked-password protection disabled
- Fix: Enable HIBP check via `configure_auth` (`password_hibp_enabled: true`) and enforce minimum length of 12.

### H3. `flush-data` edge function: weak caller verification
- Where: `supabase/functions/flush-data/index.ts` accepts `admin_id` from the request body and trusts it after a DB role check; no JWT verification of caller identity.
- Risk: An attacker who learns any admin's UUID could trigger a full data wipe.
- Fix: Replace with the same pattern used in `admin-manage-user`: read `Authorization: Bearer`, instantiate a user-scoped client, call `auth.getUser()`, then verify role from `user_roles`. Also restrict to super admin (`get_super_admin_id`). Require a confirmation token/password re-auth.

### H4. `restore-backup` upserts arbitrary rows including `user_roles`
- Where: `supabase/functions/restore-backup/index.ts`.
- Risk: A super admin (or anyone hijacking that session) can grant `admin` role to arbitrary `user_id`s by uploading a crafted JSON. While restricted to super admin, a single XSS or stolen token == full takeover.
- Fix: Validate each row with a Zod schema per table; reject rows that promote roles unless explicitly confirmed; refuse to restore `user_roles` rows that change the super admin; add server-side audit log of every changed primary key; require password re-auth before invocation.

### H5. `mpesa-callback` does not authenticate callbacks
- Where: `supabase/functions/mpesa-callback/index.ts` runs with `verify_jwt=false` and accepts any POST.
- Risk: Anyone can mark payments as `completed` and flip linked `jobs.status` by posting a forged callback with a known `CheckoutRequestID`.
- Fix: Validate the source IP against Safaricom's published ranges, and/or require a shared secret in the URL path/header that you configure on Daraja, and verify the `MerchantRequestID`/amount against the original STK push record. Consider making the path unguessable.

### H6. Input validation missing on edge functions
- Where: `admin-manage-user`, `restore-backup`, `setup-admin`, `flush-data`, payment functions all parse `req.json()` without schema validation.
- Fix: Add Zod schemas, enforce maximum body size, return 400 on parse failure. Particularly important for `newRole`, `userId`, and amount fields.

### H7. CORS wildcard on privileged functions
- Where: All edge functions set `Access-Control-Allow-Origin: *`.
- Risk: Any site can call privileged endpoints from a victim's browser; combined with bearer tokens stored in `localStorage`, a malicious page can replay tokens.
- Fix: Restrict origin to the app's published domain(s); echo origin only when in an allowlist. Keep `*` only for genuinely public callbacks.

---

## MEDIUM

### M1. Tokens persisted in `localStorage`
- Where: `src/integrations/supabase/client.ts` uses `storage: localStorage`.
- Risk: Any XSS exfiltrates the access + refresh token. With a hostile `dangerouslySetInnerHTML` or third-party script, full account takeover follows.
- Fix: Add a strict Content-Security-Policy (no `unsafe-inline`, no `unsafe-eval`, restrict script-src to self), audit all `dangerouslySetInnerHTML` usage and any user-generated HTML. Consider moving session to a backend cookie via an auth proxy if higher assurance is needed.

### M2. `SECURITY DEFINER` functions executable by anon/authenticated
- Where: ~18 helper functions including `get_super_admin_id`, `is_super_admin`, `has_role`, `admin_exists`, etc.
- Fix: `REVOKE EXECUTE ... FROM PUBLIC, anon`, then `GRANT EXECUTE ... TO authenticated` only for the functions actually needed by the client (e.g. `has_role` is fine; `get_super_admin_id` should be admin-only or service-role only).

### M3. Public buckets allow listing
- Where: `avatars`, `category-images`, `job-images`, `community-images`, `portfolio`, `chat-attachments`, `certifications` (where applicable).
- Fix: Remove broad list permissions; store object metadata in a DB table you control and serve URLs from there. For files that don't need to be listed publicly, move to a private bucket + signed URLs.

### M4. `phone_otps` has no RLS policies
- Where: RLS enabled but no policies = no access for `authenticated`. OK today, but no DELETE policy means stale OTPs accumulate; and a future "select all" policy would be catastrophic.
- Fix: Add explicit "deny by default" comment, plus a scheduled job (pg_cron) to purge expired rows. Verify only edge functions (service role) read this table.

### M5. Setup-admin endpoint has no rate limiting and is public
- Where: `supabase/functions/setup-admin/index.ts` rejects after first admin exists, but unlimited attempts before that allow brute-force registration races.
- Fix: Add IP-based rate limiting and a one-time setup token delivered out-of-band. Log all attempts.

### M6. Activity logs expose actions across realtime
- Where: `activity_logs` published to realtime; admin actions and user IDs can leak.
- Fix: Remove from publication or restrict via realtime RLS.

### M7. Worker references and work history public
- Where: `worker_work_history` and `worker_education` SELECT `USING (true)`.
- Fix: Restrict `reference_name`/`reference_phone` to owner + admin via a view; expose only role/company/dates publicly.

### M8. No password re-auth before destructive admin actions
- Risk: Stolen session tokens give full destructive power (delete user, restore backup, flush data).
- Fix: Require fresh `signInWithPassword` (or recent `aal2`) within the last 5 minutes for destructive ops.

---

## LOW

- **L1.** No CSP / security headers. Add `Content-Security-Policy`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`.
- **L2.** `service_categories`, `module_settings`, `availability` SELECT `USING (true)` - acceptable but consider `to authenticated` only.
- **L3.** No length limits on chat `content`, complaints `message`, post `content` - add server-side validation triggers (≤4000 chars) to stop storage abuse.
- **L4.** `profile_views.viewer_id IS NULL` allowed - lets clients hide views from analytics. Decide if intentional.
- **L5.** `admin-manage-user` `delete_user` does not cascade through all related tables (jobs, payments, reviews). Could leave orphan rows referencing a deleted UID.
- **L6.** No audit log entry written for failed admin attempts.
- **L7.** `.env` is committed - `VITE_*` and `SUPABASE_PUBLISHABLE_KEY` are publishable, but ensure no service-role key was ever placed there historically; rotate just in case.
- **L8.** Frontend `setWorkerOnline` writes location with no consent re-prompt; not a vuln but a privacy concern.

---

## Architectural Recommendations

1. **Defence in depth at the data layer**: split sensitive columns from public ones using views; never rely on `USING (true)` for tables containing PII or auth material.
2. **Principle of least privilege for SECURITY DEFINER functions**: explicit `REVOKE ... FROM PUBLIC` + targeted `GRANT`.
3. **Edge function hardening**: shared helper that (a) extracts JWT, (b) calls `getClaims()`, (c) loads role, (d) enforces super-admin where required, (e) Zod-validates body, (f) emits an audit log row on every privileged action.
4. **Realtime authorization**: enable channel-level RLS via `realtime.messages` and use deterministic, user-scoped topic naming.
5. **Storage**: prefer private buckets + signed URLs generated by edge functions that check ownership against the DB.
6. **Auth hardening**: enable HIBP, raise minimum password length to 12, enforce email verification, add re-auth before destructive operations, add account-lockout after N failed logins.
7. **Frontend hardening**: strict CSP, no `dangerouslySetInnerHTML` on user content, sanitize markdown if introduced, consider httpOnly cookie session via an auth proxy.
8. **Operational**: enable Postgres audit logging, add pg_cron job to purge `phone_otps` and old `activity_logs`, schedule periodic linter runs in CI.

---

## Suggested remediation order
1. C1, C2, C3, C5, C6 (data exposure & integrity) - migration + storage policies.
2. C4 (realtime) - publication + policies.
3. H3, H4, H5, H6, H7 (edge function hardening).
4. H1, H2 (profiles view, leaked-password protection).
5. M-tier hardening.
6. L-tier polish + monitoring.

No code changes were made in this audit - this plan is the deliverable. Approve to proceed with the migrations and edge function refactors in priority order.
