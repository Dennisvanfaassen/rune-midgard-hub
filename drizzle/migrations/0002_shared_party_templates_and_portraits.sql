CREATE TABLE public.party_templates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 creator_id uuid NOT NULL REFERENCES public.profiles(id),
 name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
 description text NOT NULL DEFAULT '',
 roles text[] NOT NULL CHECK (cardinality(roles) BETWEEN 1 AND 12),
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.party_templates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.party_templates TO authenticated;
GRANT ALL ON public.party_templates TO service_role;
ALTER TABLE public.party_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "templates public read" ON public.party_templates FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "owner creates template" ON public.party_templates FOR INSERT TO authenticated WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "owner updates template" ON public.party_templates FOR UPDATE TO authenticated USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "owner deletes template" ON public.party_templates FOR DELETE TO authenticated USING (auth.uid() = creator_id);
ALTER TABLE public.profiles ADD COLUMN avatar_path text;
CREATE POLICY "portrait owner upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'character-portraits' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "portrait owner update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'character-portraits' AND (storage.foldername(name))[1] = auth.uid()::text) WITH CHECK (bucket_id = 'character-portraits' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "portrait owner delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'character-portraits' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "portraits public read" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'character-portraits');