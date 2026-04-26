
-- Profile view tracker (for fundis to see how many clients viewed their profile)
CREATE TABLE IF NOT EXISTS public.profile_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id UUID NOT NULL,
  viewer_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profile_views_worker ON public.profile_views(worker_id);
CREATE INDEX IF NOT EXISTS idx_profile_views_created ON public.profile_views(created_at DESC);

ALTER TABLE public.profile_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can record a view"
  ON public.profile_views FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = viewer_id OR viewer_id IS NULL);

CREATE POLICY "Workers can view their own profile views"
  ON public.profile_views FOR SELECT TO authenticated
  USING (auth.uid() = worker_id);

CREATE POLICY "Admins manage all profile views"
  ON public.profile_views FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
