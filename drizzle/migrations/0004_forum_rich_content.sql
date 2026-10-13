ALTER TABLE public.forum_threads DROP CONSTRAINT IF EXISTS forum_threads_body_check;
ALTER TABLE public.forum_threads ADD CONSTRAINT forum_threads_body_check CHECK (char_length(body) BETWEEN 1 AND 200000);
ALTER TABLE public.forum_posts DROP CONSTRAINT IF EXISTS forum_posts_body_check;
ALTER TABLE public.forum_posts ADD CONSTRAINT forum_posts_body_check CHECK (char_length(body) BETWEEN 1 AND 100000);
CREATE POLICY "forum image owner upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'forum-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "forum image owner delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'forum-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "forum images public read" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'forum-images');