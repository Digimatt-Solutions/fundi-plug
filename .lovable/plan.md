## Goal
1. Make all storage buckets private — readable only by authenticated users — like `certifications` and `verification-docs`.
2. Add a password strength indicator to the signup form.

## Important consideration before we start

Today, 9 buckets are **public** and the app stores their `getPublicUrl(...)` results directly in the database (avatars on profiles, image_url on category-images / community-images / job-images / product-images, business logo, chat attachments, certifications, portfolio). A public URL looks like `…/object/public/<bucket>/<path>`.

If we just flip the buckets to private, **every stored URL stops working** (broken avatars, broken product photos, broken job photos, broken chat images, broken category tiles, etc.). Private buckets require **signed URLs** that expire (max ~1 week, typically minutes/hours).

So "make all buckets private" is a real refactor, not a one-line toggle. Here is how I will do it safely:

## Plan

### 1. Database migration
- Set these buckets `public = false`: `avatars`, `category-images`, `job-images`, `community-images`, `portfolio`, `chat-attachments`, `business-assets`, `product-images`, `certifications`.
- Keep `verification-docs` private (already is).
- Add `storage.objects` RLS:
  - SELECT: any **authenticated** user can read objects in the above buckets.
  - INSERT / UPDATE / DELETE: only the owner (path prefix `auth.uid()`), with admin override. For `category-images` and `community-images` (blogs) writes restricted to admins.
- Keep the existing per-bucket policies that already exist; merge where needed without dropping legitimate access.

### 2. Code refactor — switch to signed URLs

Instead of refreshing every stored URL in the DB, I will:

- **Store only the storage path** (e.g. `userId/file.jpg`) going forward for new uploads, OR detect the path from existing stored URLs and re-sign on render.
- Add a tiny helper `src/lib/storageUrl.ts` exporting `useSignedUrl(bucket, pathOrUrl)` and `signedUrl(bucket, pathOrUrl, ttl)` that:
  - If input is a `…/object/public/<bucket>/<path>` legacy URL → extract `<path>` and re-sign.
  - If input is already a path → sign directly.
  - Caches signed URLs in memory for their TTL to avoid re-signing on every render.
- Update upload sites in 11 files to call `createSignedUrl` (1 year TTL where the URL is stored long-term, e.g. avatars), or store just the path and sign on display.
- Update display sites (cards, lists, detail pages) for product images, category tiles, community posts, job photos, chat attachments, avatars, business logos, certifications and portfolio to render via the helper.

Files touched:
- `src/lib/storageUrl.ts` (new)
- Upload: `AccountProfilePage`, `AdminCategoriesPage`, `CommunityPage`, `CustomerDashboard`, `CustomerPostJobPage`, `FindWorkersPage`, `SupplierBusinessProfilePage`, `SupplierProductsPage`, `WorkerProfilePage`, `chat/ChatPopup`, `onboarding/FileUploader`, `CameraCapture`.
- Display: `MarketplacePage`, `MarketplaceProductPage`, `CategoriesScroller`, `CommunityPage`, `CustomerDashboard`, `WorkerProfilePage`, `AccountProfilePage`, `TopNavbar` (avatar), wherever images render.

### 3. Password strength indicator (signup)
- New component `src/components/auth/PasswordStrength.tsx`:
  - Score 0–4 based on length, mix of cases, digits, symbols, and a small common-password blocklist check.
  - Renders 4 colored bars + label ("Too weak", "Weak", "Fair", "Strong", "Excellent") + checklist (≥12 chars, upper, lower, number, symbol).
- Mount it under the Password field in `Auth.tsx` only when `mode === "signup"`.
- Enforce **min length 12** + score ≥ 3 to enable Create Account (matches the auth hardening we agreed on).

## Risk / rollback
- The refactor is large but mechanical. Each file edit is independent.
- If any image fails to render after deploy, the helper falls back to the original stored string so we never crash.
- All migration changes are reversible (`UPDATE storage.buckets SET public = true`).

## Approval needed
Because step 2 touches ~15 files and changes how every image in the app loads, I want your explicit go-ahead before I start. Reply **"go"** to proceed, or tell me to skip making display-asset buckets private and only lock down the sensitive ones (`certifications`, `portfolio`, `chat-attachments`, `business-assets`).
