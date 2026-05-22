## Scope

1. **Auth signup form**: Put Full Name + Email on the same row (two-column grid).
2. **Suppliers in Community/Chat**: Already enabled via `module_settings`. Verify the community page (posts/likes/comments) and chat are not role-gated so suppliers can post, comment, like, and chat. Add small fixes if any role checks block them.
3. **Business Profile module (suppliers)**
4. **Admin Business Verification**
5. **Products & Services module (suppliers, gated on approved business)**
6. **Universal Marketplace (all users)**

## Database changes

Two new tables in a single migration:

**`business_profiles`** (one per supplier)
- `user_id` (uuid, unique, supplier)
- `business_name`, `description`
- `logo_url`, `banner_url`
- `category`, `category_other`
- `physical_address`, `county`, `town`
- `latitude`, `longitude` (Google Maps pick)
- `business_email`, `business_phone`, `website`
- `kra_pin`, `registration_number`, `years_in_operation`
- `verification_status`: enum `business_verification_status` = `draft | pending | approved | rejected`
- `rejection_reason`, `submitted_at`, `approved_at`, `approved_by`
- RLS: owner can CRUD their own; everyone authenticated can SELECT (catalog); admins can manage all.

**`supplier_products`**
- `business_id` (uuid → business_profiles)
- `supplier_id` (uuid → profiles, denormalized for fast queries)
- `name`, `category`, `description`
- `images` (text[])
- `price` (numeric), `unit` (text), `stock_status` (text: `in_stock|low|out_of_stock`)
- `min_order_qty` (int)
- `delivery_areas` (text[])
- `is_featured` (bool), `is_active` (bool)
- RLS: supplier owns own; everyone authenticated can SELECT active products where business is approved; admins manage all.
- Trigger: reject inserts/updates if business not `approved`.

Storage buckets: reuse existing `avatars` for logos / `community-images` for product images, or add a `business-assets` public bucket and `product-images` public bucket — cleaner separation.

Add `module_settings` rows for supplier:
- `business_profile`
- `products`
- `marketplace` (all roles)

## Pages / Components

- `src/pages/SupplierBusinessProfilePage.tsx` — form + status banner + submit-for-verification.
- `src/pages/SupplierProductsPage.tsx` — list + create/edit dialog; locked screen if business not approved.
- `src/pages/MarketplacePage.tsx` — public catalog with search + category filter + product cards.
- `src/pages/MarketplaceProductPage.tsx` — product detail with verified supplier card.
- `src/pages/AdminBusinessVerificationsPage.tsx` — admin queue (pending, approved, rejected tabs) + approve/reject.
- Update `SupplierDashboard` to surface business verification status + product count + quick links.
- Update `AppSidebar` to add Business Profile, Products (locked until approved), Marketplace entries. Marketplace also visible to clients/fundis/admins.
- Update `AdminDashboard` to show pending businesses count card.
- Update `App.tsx` routes.

## Auth form

Update `src/pages/Auth.tsx` signup section: wrap Full Name + Email in a `grid grid-cols-1 sm:grid-cols-2 gap-3` row.

## Out of scope

- Cart / checkout / payments on marketplace (catalog only this round; can be added later).
- Editing existing community/chat code beyond verifying suppliers aren't blocked.
