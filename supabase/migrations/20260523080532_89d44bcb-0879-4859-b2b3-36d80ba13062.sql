ALTER TABLE public.worker_profiles
  ADD COLUMN IF NOT EXISTS good_conduct_url text,
  ADD COLUMN IF NOT EXISTS other_licenses jsonb NOT NULL DEFAULT '[]'::jsonb;