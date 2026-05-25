-- 1. Flip buckets to private
UPDATE storage.buckets
SET public = false
WHERE id IN (
  'avatars',
  'category-images',
  'job-images',
  'community-images',
  'portfolio',
  'chat-attachments',
  'business-assets',
  'product-images',
  'certifications'
);

-- 2. Allow any authenticated user to read objects in these buckets via signed URLs
DROP POLICY IF EXISTS "Authenticated can read shared asset buckets" ON storage.objects;
CREATE POLICY "Authenticated can read shared asset buckets"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id IN (
    'avatars',
    'category-images',
    'job-images',
    'community-images',
    'portfolio',
    'chat-attachments',
    'business-assets',
    'product-images',
    'certifications'
  )
);

-- 3. Owners can write/update/delete files inside their own userId/* folder
--    for the per-user buckets (avatars, job-images, portfolio, chat-attachments,
--    business-assets, product-images, certifications, community-images)
DROP POLICY IF EXISTS "Owners can upload to own folder" ON storage.objects;
CREATE POLICY "Owners can upload to own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id IN (
    'avatars','job-images','portfolio','chat-attachments',
    'business-assets','product-images','certifications','community-images'
  )
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Owners can update own files" ON storage.objects;
CREATE POLICY "Owners can update own files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id IN (
    'avatars','job-images','portfolio','chat-attachments',
    'business-assets','product-images','certifications','community-images'
  )
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Owners can delete own files" ON storage.objects;
CREATE POLICY "Owners can delete own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id IN (
    'avatars','job-images','portfolio','chat-attachments',
    'business-assets','product-images','certifications','community-images'
  )
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 4. Admins can write to category-images (which uses a flat path)
DROP POLICY IF EXISTS "Admins manage category images" ON storage.objects;
CREATE POLICY "Admins manage category images"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'category-images' AND public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (bucket_id = 'category-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- 5. Admins can also manage any of the shared buckets (cleanup / moderation)
DROP POLICY IF EXISTS "Admins manage all shared asset buckets" ON storage.objects;
CREATE POLICY "Admins manage all shared asset buckets"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id IN (
    'avatars','category-images','job-images','community-images',
    'portfolio','chat-attachments','business-assets','product-images','certifications'
  )
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  bucket_id IN (
    'avatars','category-images','job-images','community-images',
    'portfolio','chat-attachments','business-assets','product-images','certifications'
  )
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);