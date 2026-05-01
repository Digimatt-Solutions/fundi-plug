## Goal

Remove the email re-verification step for admins. Both newly-promoted admins (via User Management) and admins created via `/setup-admin` should be able to sign in immediately with no email confirmation required.

## Changes

### 1. Edge function: `supabase/functions/admin-manage-user/index.ts` (`promote_to_admin` action)

- Stop setting `email_confirm: false`. Instead set `email_confirm: true` so the account is auto-confirmed.
- Remove the `pending_admin_verification` / `promoted_at` metadata flags (no longer needed).
- Remove the `auth.admin.signOut(userId, "global")` call so the user isn't kicked out.
- Remove the `generateLink({ type: "signup" })` call (no verification email needed).
- Keep: role upsert to `admin` and the activity log entry (update detail text to "no verification required").
- Return `{ success: true, email }` as before.

### 2. Edge function: `supabase/functions/setup-admin/index.ts`

- Change `admin.auth.admin.createUser` to use `email_confirm: true` so the bootstrap admin can sign in immediately without checking email.
- Remove the follow-up `generateLink({ type: "signup" })` call.
- Response unchanged.

### 3. Frontend: `src/pages/UserManagementPage.tsx`

- Update the Promote dialog copy: remove the amber "must re-verify email" warning. Replace with a simple confirmation that the user will gain admin access on their next sign-in (or immediately if already signed in).
- Update the success toast: "Promoted to Admin - {name} now has administrator access."
- Update button label from "Promote & Send Verification" to just "Promote to Admin".

### 4. Frontend: `src/pages/Auth.tsx`

- Remove the `is_pending_admin_promotion` RPC check and the green `promotionMessage` banner block (lines ~190-196 and ~282-288), since promotion no longer triggers a pending-verification state.
- Drop the now-unused `promotionMessage` state and the `ShieldCheck` import if unused elsewhere.

### 5. Frontend: `src/pages/SetupAdminPage.tsx` (verify and adjust copy)

- Read the page and update any "check your email to verify" success copy to reflect that the admin can sign in immediately at `/auth`.

### 6. Database

- The `is_pending_admin_promotion` SQL function becomes dead code. Leave it in place (no migration) to avoid touching the schema unnecessarily; it simply won't be called anymore.
- No migration required.

## Out of scope

- Email infrastructure / SMTP setup (no longer relevant for this flow).
- Changes to client/fundi signup, which still go through normal email verification per Supabase auth settings.

## Verification steps after implementation

1. From `/setup-admin` (with no admin in DB), create an admin → sign in immediately at `/auth` with no email step.
2. As admin, promote a regular user via User Management → that user signs out and back in (or refreshes session) and lands on the admin dashboard with no verification prompt.
