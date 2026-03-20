
DROP POLICY "System can insert logs" ON public.activity_logs;
CREATE POLICY "Authenticated can insert own logs" ON public.activity_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
