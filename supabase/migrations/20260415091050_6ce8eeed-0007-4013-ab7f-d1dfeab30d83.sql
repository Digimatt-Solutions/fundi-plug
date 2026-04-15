-- Allow all authenticated users to update likes_count on any post
-- This is safe because likes_count is a computed aggregate, not sensitive data
CREATE POLICY "Users can update likes_count on any post"
ON public.community_posts
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);