
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS attachment_url text,
  ADD COLUMN IF NOT EXISTS attachment_type text,
  ADD COLUMN IF NOT EXISTS attachment_name text;

-- Allow content to be empty when an attachment is provided
ALTER TABLE public.messages ALTER COLUMN content DROP NOT NULL;

INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Chat attachments are publicly readable') THEN
    CREATE POLICY "Chat attachments are publicly readable"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'chat-attachments');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Authenticated can upload chat attachments') THEN
    CREATE POLICY "Authenticated can upload chat attachments"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'chat-attachments');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Owners can manage their chat attachments') THEN
    CREATE POLICY "Owners can manage their chat attachments"
      ON storage.objects FOR ALL TO authenticated
      USING (bucket_id = 'chat-attachments' AND owner = auth.uid())
      WITH CHECK (bucket_id = 'chat-attachments' AND owner = auth.uid());
  END IF;
END $$;
