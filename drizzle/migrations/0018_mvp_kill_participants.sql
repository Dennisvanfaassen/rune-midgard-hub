-- Multiple guildmates can receive a participation credit for one boss kill.
-- Only the original kill reporter can add/remove participants for their report.
CREATE TABLE IF NOT EXISTS public.mvp_kill_participants (
  kill_id uuid NOT NULL REFERENCES public.mvp_kills(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  added_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(kill_id,user_id)
);
CREATE INDEX IF NOT EXISTS mvp_kill_participants_user_idx ON public.mvp_kill_participants(user_id);
ALTER TABLE public.mvp_kill_participants ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,DELETE ON public.mvp_kill_participants TO authenticated;
DROP POLICY IF EXISTS "Guild reads boss kill participants" ON public.mvp_kill_participants;
CREATE POLICY "Guild reads boss kill participants" ON public.mvp_kill_participants FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Reporter credits party participants" ON public.mvp_kill_participants;
CREATE POLICY "Reporter credits party participants" ON public.mvp_kill_participants FOR INSERT TO authenticated
WITH CHECK (added_by=(SELECT auth.uid()) AND EXISTS (
 SELECT 1 FROM public.mvp_kills k WHERE k.id=kill_id AND k.reporter_id=(SELECT auth.uid())
));
DROP POLICY IF EXISTS "Reporter removes party participants" ON public.mvp_kill_participants;
CREATE POLICY "Reporter removes party participants" ON public.mvp_kill_participants FOR DELETE TO authenticated USING (
 EXISTS (SELECT 1 FROM public.mvp_kills k WHERE k.id=kill_id AND k.reporter_id=(SELECT auth.uid()))
);
