This is a large, multi-area change. Below is what I'll do, grouped by area. I'll only proceed after you approve.

## 1. Urgent jobs UI
- Find the "Urgent" job rendering (instant/urgent flag) and remove the red tinted card background.
- Keep only a small blinking red "Urgent" badge. The rest of the card matches every other job card.

## 2. Emoji → Lucide icons sweep
Replace decorative emojis with `lucide-react` icons everywhere they appear in app UI:
- `CustomerPostJobPage`, `WorkerMyJobsPage`, `CustomerBookingsPage`, `FindWorkersPage`, `CommunityPage`, `LocationPicker`, `Auth` reset confirmation, `AdminCategoriesPage` category icon picker.
- `service_categories.icon` is a stored emoji string. I will:
  - Add an "icon name" mode (Lucide icon name string e.g. `Wrench`, `Zap`, `Wrench`) to the category form, keeping the existing field for backward compat.
  - Render via a small `<CategoryIcon name={cat.icon} />` helper that maps name→component, with a Wrench fallback.
  - Existing emoji values keep rendering (fallback), but admins can switch to a Lucide name.
- Replace `📩`, `💰`, `📍`, `✕` (close buttons), `🔧` defaults, `✓` text with Lucide equivalents (`Inbox`, `Wallet`, `MapPin`, `X`, `Wrench`, `Check`).

## 3. Email change lockdown
- DB trigger `prevent_profile_email_change` already blocks direct table writes — keep it.
- Add a new edge function `admin-change-email` (admin-only, uses service role + Auth Admin API) that:
  - Verifies caller is admin via `has_role`.
  - Calls `supabase.auth.admin.updateUserById(targetId, { email })` then updates `public.profiles.email`.
  - Logs to `activity_logs`.
- Remove/disable any client UI that lets a user edit their own email (read-only field in `AccountProfilePage` / `SettingsPage`); show a helper "Contact admin to change email".
- Add an admin-only "Change Email" action in `UserManagementPage` that calls the new function.

## 4. Reviews — owner/admin delete + admin module
- Migration:
  - Add RLS policy on `reviews`: `DELETE` allowed when `auth.uid() = reviewer_id` (admins already covered by manage-all).
- `WorkerReviewsPage` and `PublicReviewsPage` / customer review views: show a trash button on each review when `user.id === reviewer_id` (or admin), with confirm dialog.
- New admin page `AdminReviewsPage` at `/dashboard/admin/reviews`:
  - Two tabs: "Reviews of Fundis" and "Reviews of Clients".
  - Group by service category (joining `jobs.category_id → service_categories.name`).
  - Each row shows reviewer, reviewee, rating, comment, job title, category, date, delete button.
- Add sidebar link for admins.

## 5. IDOR / ownership hardening on edge functions
Audit every function in `supabase/functions/*` that takes an `id`/`user_id` from the request body and ensure:
- The caller JWT is validated, `auth.uid()` derived server-side (not from body).
- Action only proceeds when `auth.uid()` matches the owner column, OR caller is admin (via `has_role` SQL).
- Targets to review/patch: `change-password`, `revoke-token`, `mpesa-stk-push`, `create-payment`, `paystack-initiate-payment`, `paystack-verify-payment`, `verify-payment`, `send-otp`, `verify-otp`, `reset-password-with-otp`, `admin-manage-user`, `flush-data`, `restore-backup`, `webauthn-lookup`.
- For each, replace any `body.user_id` ownership with the JWT user id; keep `target_user_id` only when caller is admin.

## Out of scope (to keep this safe)
- Won't touch payment business logic, only the auth guards around endpoints.
- Won't restyle category cards beyond swapping the icon renderer.
- Won't change existing review insert logic.

If this looks right, approve and I'll execute. If you'd like me to **split** this into separate smaller passes (e.g. just #1+#2 first, then #3, then #4, then #5), say which order.