
-- Complaints table
CREATE TABLE public.complaints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL,
  fundi_id UUID NOT NULL,
  job_id UUID NOT NULL,
  message TEXT NOT NULL,
  admin_reply TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can create complaints" ON public.complaints FOR INSERT TO authenticated WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "Customers can view own complaints" ON public.complaints FOR SELECT TO authenticated USING (auth.uid() = customer_id);
CREATE POLICY "Fundis can view complaints about them" ON public.complaints FOR SELECT TO authenticated USING (auth.uid() = fundi_id);
CREATE POLICY "Admins can manage all complaints" ON public.complaints FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Module settings table
CREATE TABLE public.module_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_key TEXT NOT NULL,
  role TEXT NOT NULL,
  label TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(module_key, role)
);

ALTER TABLE public.module_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view module settings" ON public.module_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage module settings" ON public.module_settings FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed default module settings for workers
INSERT INTO public.module_settings (module_key, role, label, enabled) VALUES
  ('my-jobs', 'worker', 'My Jobs', true),
  ('profile', 'worker', 'Profile', true),
  ('earnings', 'worker', 'Earnings', true),
  ('reviews', 'worker', 'Reviews', true),
  ('payments', 'worker', 'Payments', true),
  ('settings', 'worker', 'Settings', true);

-- Seed default module settings for customers
INSERT INTO public.module_settings (module_key, role, label, enabled) VALUES
  ('post-job', 'customer', 'Post a Job', true),
  ('find-workers', 'customer', 'Find Fundis', true),
  ('bookings', 'customer', 'My Bookings', true),
  ('payments', 'customer', 'Payments', true),
  ('complaints', 'customer', 'Complaints', true),
  ('settings', 'customer', 'Settings', true);
