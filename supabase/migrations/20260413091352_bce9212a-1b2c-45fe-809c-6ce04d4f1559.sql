-- Fix activity_logs: SET NULL on delete
ALTER TABLE public.activity_logs DROP CONSTRAINT IF EXISTS activity_logs_user_id_fkey;
ALTER TABLE public.activity_logs ADD CONSTRAINT activity_logs_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Fix bookings: CASCADE on delete
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_customer_id_fkey;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_customer_id_fkey 
  FOREIGN KEY (customer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_worker_id_fkey;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_worker_id_fkey 
  FOREIGN KEY (worker_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Fix jobs: customer CASCADE, worker SET NULL
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_customer_id_fkey;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_customer_id_fkey 
  FOREIGN KEY (customer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_worker_id_fkey;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_worker_id_fkey 
  FOREIGN KEY (worker_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Fix job_applications: CASCADE on delete
ALTER TABLE public.job_applications DROP CONSTRAINT IF EXISTS job_applications_worker_id_fkey;
ALTER TABLE public.job_applications ADD CONSTRAINT job_applications_worker_id_fkey 
  FOREIGN KEY (worker_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Fix payments: CASCADE on delete
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_payer_id_fkey;
ALTER TABLE public.payments ADD CONSTRAINT payments_payer_id_fkey 
  FOREIGN KEY (payer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_payee_id_fkey;
ALTER TABLE public.payments ADD CONSTRAINT payments_payee_id_fkey 
  FOREIGN KEY (payee_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Fix reviews: CASCADE on delete
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_reviewer_id_fkey;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_reviewer_id_fkey 
  FOREIGN KEY (reviewer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_reviewee_id_fkey;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_reviewee_id_fkey 
  FOREIGN KEY (reviewee_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Fix complaints: already CASCADE, but ensure job_id too
ALTER TABLE public.complaints DROP CONSTRAINT IF EXISTS complaints_job_id_fkey;
ALTER TABLE public.complaints ADD CONSTRAINT complaints_job_id_fkey 
  FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;

-- Fix job_applications job_id
ALTER TABLE public.job_applications DROP CONSTRAINT IF EXISTS job_applications_job_id_fkey;
ALTER TABLE public.job_applications ADD CONSTRAINT job_applications_job_id_fkey 
  FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;

-- Fix bookings job_id
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_job_id_fkey;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_job_id_fkey 
  FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;

-- Fix payments job_id
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_job_id_fkey;
ALTER TABLE public.payments ADD CONSTRAINT payments_job_id_fkey 
  FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;

-- Fix reviews job_id
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_job_id_fkey;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_job_id_fkey 
  FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;