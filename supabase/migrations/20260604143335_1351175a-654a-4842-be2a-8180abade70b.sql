-- Allow customers to delete their own jobs (was missing — delete button never worked)
CREATE POLICY "Customers can delete own jobs"
  ON public.jobs
  FOR DELETE
  TO authenticated
  USING (auth.uid() = customer_id);

-- Track when a fundi rejects a proposed final price so the client UI can react
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS price_rejected_at timestamptz;

-- M-Pesa transaction code captured when admin marks a disbursement as sent
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS mpesa_code text;