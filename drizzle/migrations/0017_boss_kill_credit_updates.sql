-- Allow reporters to claim participation on previously reported mini-boss kills.
-- A database check from migration 0014 limits killer_id to the original reporter.
DROP POLICY IF EXISTS "Reporters can update own boss kill credit" ON public.mvp_kills;
CREATE POLICY "Reporters can update own boss kill credit"
ON public.mvp_kills FOR UPDATE TO authenticated
USING (reporter_id=(SELECT auth.uid()))
WITH CHECK (reporter_id=(SELECT auth.uid()) AND (killer_id IS NULL OR killer_id=(SELECT auth.uid())));
