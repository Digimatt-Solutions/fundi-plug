
ALTER TABLE public.complaints
  ADD CONSTRAINT complaints_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT complaints_fundi_id_fkey FOREIGN KEY (fundi_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT complaints_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;
