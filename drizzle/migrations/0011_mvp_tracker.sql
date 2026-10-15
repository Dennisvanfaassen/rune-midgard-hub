-- Shared MVP tracker. Run once in Lovable Cloud SQL editor.
CREATE TABLE IF NOT EXISTS public.mvp_kills (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 boss_key text NOT NULL,
 map_key text NOT NULL,
 killed_at timestamptz NOT NULL,
 tomb_x numeric(6,5) CHECK (tomb_x BETWEEN 0 AND 1),
 tomb_y numeric(6,5) CHECK (tomb_y BETWEEN 0 AND 1),
 reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((tomb_x IS NULL) = (tomb_y IS NULL))
);
CREATE INDEX IF NOT EXISTS mvp_kills_recent_idx ON public.mvp_kills(boss_key,map_key,killed_at DESC);
CREATE INDEX IF NOT EXISTS mvp_kills_created_idx ON public.mvp_kills(created_at DESC);
ALTER TABLE public.mvp_kills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Guild members can see MVP kills" ON public.mvp_kills;
CREATE POLICY "Guild members can see MVP kills" ON public.mvp_kills FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Guild members can report MVP kills" ON public.mvp_kills;
CREATE POLICY "Guild members can report MVP kills" ON public.mvp_kills FOR INSERT TO authenticated WITH CHECK (reporter_id = (SELECT auth.uid()) AND killed_at <= now() + interval '1 minute');
DROP POLICY IF EXISTS "Reporters can undo their own MVP reports" ON public.mvp_kills;
CREATE POLICY "Reporters can undo their own MVP reports" ON public.mvp_kills FOR DELETE TO authenticated USING (reporter_id = (SELECT auth.uid()));
-- One shared tomb position per MVP and map, independent of its kill history.
CREATE TABLE IF NOT EXISTS public.mvp_tombs (
 boss_key text NOT NULL,
 map_key text NOT NULL,
 tomb_x numeric(6,5) NOT NULL CHECK (tomb_x BETWEEN 0 AND 1),
 tomb_y numeric(6,5) NOT NULL CHECK (tomb_y BETWEEN 0 AND 1),
 updated_by uuid NOT NULL REFERENCES auth.users(id),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (boss_key,map_key)
);
ALTER TABLE public.mvp_tombs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Guild members can see MVP tomb pins" ON public.mvp_tombs;
CREATE POLICY "Guild members can see MVP tomb pins" ON public.mvp_tombs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Guild members can place MVP tomb pins" ON public.mvp_tombs;
CREATE POLICY "Guild members can place MVP tomb pins" ON public.mvp_tombs FOR INSERT TO authenticated WITH CHECK (updated_by = (SELECT auth.uid()));
DROP POLICY IF EXISTS "Guild members can update MVP tomb pins" ON public.mvp_tombs;
CREATE POLICY "Guild members can update MVP tomb pins" ON public.mvp_tombs FOR UPDATE TO authenticated USING (true) WITH CHECK (updated_by = (SELECT auth.uid()));
