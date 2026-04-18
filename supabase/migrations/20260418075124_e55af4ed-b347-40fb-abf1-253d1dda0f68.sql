-- Phase A: Extend worker_profiles with detailed onboarding fields
ALTER TABLE public.worker_profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS middle_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS alt_phone text,
  ADD COLUMN IF NOT EXISTS profile_photo_url text,
  ADD COLUMN IF NOT EXISTS next_of_kin_name text,
  ADD COLUMN IF NOT EXISTS next_of_kin_relationship text,
  ADD COLUMN IF NOT EXISTS next_of_kin_phone text,
  ADD COLUMN IF NOT EXISTS selfie_with_id_url text,
  ADD COLUMN IF NOT EXISTS id_front_url text,
  ADD COLUMN IF NOT EXISTS id_back_url text,
  ADD COLUMN IF NOT EXISTS experience_level text,
  ADD COLUMN IF NOT EXISTS daily_rate numeric,
  ADD COLUMN IF NOT EXISTS tools_owned text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS portfolio_urls text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS availability_days int[] DEFAULT '{}'::int[],
  ADD COLUMN IF NOT EXISTS availability_type text,
  ADD COLUMN IF NOT EXISTS sub_skills text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS other_skill text,
  ADD COLUMN IF NOT EXISTS exact_address text,
  ADD COLUMN IF NOT EXISTS landmark text,
  ADD COLUMN IF NOT EXISTS willing_to_travel boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_travel_km int,
  ADD COLUMN IF NOT EXISTS service_radius_km int,
  ADD COLUMN IF NOT EXISTS kra_pin text,
  ADD COLUMN IF NOT EXISTS nca_number text,
  ADD COLUMN IF NOT EXISTS mpesa_number text,
  ADD COLUMN IF NOT EXISTS mpesa_name text,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_account text,
  ADD COLUMN IF NOT EXISTS consent_background_check boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_data_usage boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS consented_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_step int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_for_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Extend certifications
ALTER TABLE public.certifications
  ADD COLUMN IF NOT EXISTS issuer text,
  ADD COLUMN IF NOT EXISTS cert_number text;

-- New table: worker_education
CREATE TABLE IF NOT EXISTS public.worker_education (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL,
  level text NOT NULL,
  institution text NOT NULL,
  course text,
  status text,
  start_date date,
  end_date date,
  file_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.worker_education ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Education viewable by authenticated"
  ON public.worker_education FOR SELECT TO authenticated USING (true);

CREATE POLICY "Workers manage own education"
  ON public.worker_education FOR ALL TO authenticated
  USING (auth.uid() = worker_id) WITH CHECK (auth.uid() = worker_id);

CREATE POLICY "Admins manage all education"
  ON public.worker_education FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- New table: worker_work_history
CREATE TABLE IF NOT EXISTS public.worker_work_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL,
  role text NOT NULL,
  company text,
  start_date date,
  end_date date,
  description text,
  reference_name text,
  reference_phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.worker_work_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Work history viewable by authenticated"
  ON public.worker_work_history FOR SELECT TO authenticated USING (true);

CREATE POLICY "Workers manage own work history"
  ON public.worker_work_history FOR ALL TO authenticated
  USING (auth.uid() = worker_id) WITH CHECK (auth.uid() = worker_id);

CREATE POLICY "Admins manage all work history"
  ON public.worker_work_history FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('portfolio', 'portfolio', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('verification-docs', 'verification-docs', false)
ON CONFLICT (id) DO NOTHING;

-- Avatars policies (public read, owner write)
CREATE POLICY "Avatars publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users upload own avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own avatar"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own avatar"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Portfolio policies (public read, owner write)
CREATE POLICY "Portfolio publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'portfolio');

CREATE POLICY "Users upload own portfolio"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'portfolio' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own portfolio"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'portfolio' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own portfolio"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'portfolio' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Verification docs policies (private: owner + admins only)
CREATE POLICY "Owner reads own verification docs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'verification-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins read all verification docs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'verification-docs' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users upload own verification docs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'verification-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own verification docs"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'verification-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own verification docs"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'verification-docs' AND auth.uid()::text = (storage.foldername(name))[1]);