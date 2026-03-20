
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'customer', 'worker');
CREATE TYPE public.verification_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.job_status AS ENUM ('pending', 'accepted', 'in_progress', 'completed', 'cancelled');
CREATE TYPE public.booking_status AS ENUM ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled');
CREATE TYPE public.payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');

-- UPDATED_AT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- PROFILES TABLE
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- USER_ROLES TABLE
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1 $$;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- SERVICE_CATEGORIES TABLE
CREATE TABLE public.service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  icon TEXT DEFAULT '🔧',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Categories viewable by all" ON public.service_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage categories" ON public.service_categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.service_categories (name, icon) VALUES
  ('Electrician', '⚡'), ('Plumber', '🔧'), ('Carpenter', '🪚'),
  ('Painter', '🎨'), ('HVAC', '❄️'), ('Cleaner', '🧹');

-- WORKER_PROFILES TABLE
CREATE TABLE public.worker_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  skills UUID[] DEFAULT '{}',
  years_experience INTEGER DEFAULT 0,
  bio TEXT DEFAULT '',
  hourly_rate NUMERIC(10,2),
  verification_status verification_status NOT NULL DEFAULT 'pending',
  is_online BOOLEAN NOT NULL DEFAULT false,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  service_area TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.worker_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Worker profiles viewable by authenticated" ON public.worker_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Workers can update own profile" ON public.worker_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Workers can insert own profile" ON public.worker_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage worker profiles" ON public.worker_profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_worker_profiles_updated_at BEFORE UPDATE ON public.worker_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CERTIFICATIONS TABLE
CREATE TABLE public.certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES public.worker_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_url TEXT,
  issued_at DATE,
  expires_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.certifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Certifications viewable by authenticated" ON public.certifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Workers can manage own certs" ON public.certifications FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.worker_profiles wp WHERE wp.id = worker_id AND wp.user_id = auth.uid()));

-- JOBS TABLE
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  worker_id UUID REFERENCES auth.users(id),
  category_id UUID REFERENCES public.service_categories(id),
  title TEXT NOT NULL,
  description TEXT,
  status job_status NOT NULL DEFAULT 'pending',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  address TEXT,
  budget NUMERIC(10,2),
  is_instant BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers can view own jobs" ON public.jobs FOR SELECT TO authenticated USING (auth.uid() = customer_id);
CREATE POLICY "Workers can view assigned jobs" ON public.jobs FOR SELECT TO authenticated USING (auth.uid() = worker_id);
CREATE POLICY "Workers can view pending jobs" ON public.jobs FOR SELECT TO authenticated USING (status = 'pending' AND public.has_role(auth.uid(), 'worker'));
CREATE POLICY "Admins can view all jobs" ON public.jobs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Customers can create jobs" ON public.jobs FOR INSERT TO authenticated WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "Workers can update assigned jobs" ON public.jobs FOR UPDATE TO authenticated USING (auth.uid() = worker_id);
CREATE POLICY "Customers can update own jobs" ON public.jobs FOR UPDATE TO authenticated USING (auth.uid() = customer_id);
CREATE POLICY "Admins can manage all jobs" ON public.jobs FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- BOOKINGS TABLE
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES auth.users(id),
  worker_id UUID NOT NULL REFERENCES auth.users(id),
  scheduled_at TIMESTAMPTZ,
  status booking_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own bookings" ON public.bookings FOR SELECT TO authenticated USING (auth.uid() IN (customer_id, worker_id));
CREATE POLICY "Admins can view all bookings" ON public.bookings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Customers can create bookings" ON public.bookings FOR INSERT TO authenticated WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "Participants can update bookings" ON public.bookings FOR UPDATE TO authenticated USING (auth.uid() IN (customer_id, worker_id));
CREATE POLICY "Admins can manage bookings" ON public.bookings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- REVIEWS TABLE
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES auth.users(id),
  reviewee_id UUID NOT NULL REFERENCES auth.users(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reviews viewable by authenticated" ON public.reviews FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create reviews" ON public.reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = reviewer_id);
CREATE POLICY "Admins can manage reviews" ON public.reviews FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- PAYMENTS TABLE
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  payer_id UUID NOT NULL REFERENCES auth.users(id),
  payee_id UUID NOT NULL REFERENCES auth.users(id),
  amount NUMERIC(10,2) NOT NULL,
  commission NUMERIC(10,2) DEFAULT 0,
  status payment_status NOT NULL DEFAULT 'pending',
  stripe_payment_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own payments" ON public.payments FOR SELECT TO authenticated USING (auth.uid() IN (payer_id, payee_id));
CREATE POLICY "Admins can view all payments" ON public.payments FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage payments" ON public.payments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- AVAILABILITY TABLE
CREATE TABLE public.availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  UNIQUE (worker_id, day_of_week)
);
ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Availability viewable by authenticated" ON public.availability FOR SELECT TO authenticated USING (true);
CREATE POLICY "Workers can manage own availability" ON public.availability FOR ALL TO authenticated USING (auth.uid() = worker_id);

-- ACTIVITY_LOGS TABLE
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  detail TEXT,
  entity_type TEXT,
  entity_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view all logs" ON public.activity_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own logs" ON public.activity_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "System can insert logs" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (true);

-- PLATFORM_SETTINGS TABLE
CREATE TABLE public.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Settings viewable by admins" ON public.platform_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage settings" ON public.platform_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.platform_settings (key, value) VALUES ('platform_name', 'SkillHub'), ('commission_rate', '15');

-- AUTO-CREATE PROFILE & ROLE ON SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _role app_role;
  _name TEXT;
  _user_count INTEGER;
BEGIN
  _name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  _role := COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'customer');
  SELECT COUNT(*) INTO _user_count FROM public.profiles;
  IF _user_count = 0 THEN _role := 'admin'; END IF;
  INSERT INTO public.profiles (id, email, name, phone) VALUES (NEW.id, NEW.email, _name, NEW.raw_user_meta_data->>'phone');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role);
  IF _role = 'worker' THEN INSERT INTO public.worker_profiles (user_id) VALUES (NEW.id); END IF;
  INSERT INTO public.activity_logs (user_id, action, detail, entity_type, entity_id) VALUES (NEW.id, 'User Registered', 'Signed up as ' || _role::text, 'user', NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
