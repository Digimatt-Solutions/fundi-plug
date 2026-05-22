
-- Verification status enum
DO $$ BEGIN
  CREATE TYPE public.business_verification_status AS ENUM ('draft','pending','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Business profiles
CREATE TABLE IF NOT EXISTS public.business_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  business_name text NOT NULL DEFAULT '',
  description text,
  logo_url text,
  banner_url text,
  category text,
  category_other text,
  physical_address text,
  county text,
  town text,
  latitude double precision,
  longitude double precision,
  business_email text,
  business_phone text,
  website text,
  kra_pin text,
  registration_number text,
  years_in_operation integer,
  verification_status public.business_verification_status NOT NULL DEFAULT 'draft',
  rejection_reason text,
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business profiles viewable by authenticated"
  ON public.business_profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Suppliers manage own business profile"
  ON public.business_profiles FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage all business profiles"
  ON public.business_profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_business_profiles_updated_at
  BEFORE UPDATE ON public.business_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Supplier products
CREATE TABLE IF NOT EXISTS public.supplier_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  supplier_id uuid NOT NULL,
  name text NOT NULL,
  category text,
  description text,
  images text[] NOT NULL DEFAULT '{}',
  price numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'piece',
  stock_status text NOT NULL DEFAULT 'in_stock',
  min_order_qty integer NOT NULL DEFAULT 1,
  delivery_areas text[] NOT NULL DEFAULT '{}',
  is_featured boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active products from approved businesses viewable"
  ON public.supplier_products FOR SELECT TO authenticated
  USING (
    is_active = true AND EXISTS (
      SELECT 1 FROM public.business_profiles bp
      WHERE bp.id = supplier_products.business_id AND bp.verification_status = 'approved'
    )
    OR auth.uid() = supplier_id
    OR public.has_role(auth.uid(),'admin')
  );

CREATE POLICY "Suppliers manage own products"
  ON public.supplier_products FOR ALL TO authenticated
  USING (auth.uid() = supplier_id) WITH CHECK (auth.uid() = supplier_id);

CREATE POLICY "Admins manage all products"
  ON public.supplier_products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_supplier_products_updated_at
  BEFORE UPDATE ON public.supplier_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: only allow product writes if business approved
CREATE OR REPLACE FUNCTION public.enforce_business_approved_for_product()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _status text;
BEGIN
  SELECT verification_status::text INTO _status FROM public.business_profiles WHERE id = NEW.business_id;
  IF _status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'Business must be approved before managing products.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_enforce_business_approved
  BEFORE INSERT OR UPDATE ON public.supplier_products
  FOR EACH ROW EXECUTE FUNCTION public.enforce_business_approved_for_product();

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('business-assets','business-assets', true)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images','product-images', true)
  ON CONFLICT (id) DO NOTHING;

-- Storage policies (path = userId/...)
CREATE POLICY "Business assets public read"
  ON storage.objects FOR SELECT USING (bucket_id = 'business-assets');
CREATE POLICY "Owners upload business assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'business-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Owners update business assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'business-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Owners delete business assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'business-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Product images public read"
  ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
CREATE POLICY "Owners upload product images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Owners update product images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Owners delete product images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Module settings
INSERT INTO public.module_settings (role, module_key, label, enabled) VALUES
  ('supplier','business_profile','Business Profile', true),
  ('supplier','products','Products & Services', true),
  ('supplier','marketplace','Marketplace', true),
  ('customer','marketplace','Marketplace', true),
  ('worker','marketplace','Marketplace', true),
  ('admin','marketplace','Marketplace', true),
  ('admin','business_verifications','Business Verifications', true)
ON CONFLICT DO NOTHING;
