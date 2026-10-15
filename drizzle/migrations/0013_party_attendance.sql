-- Party attendance updates; run once in Lovable Cloud SQL Editor.
CREATE TABLE IF NOT EXISTS public.party_attendance (
  party_id uuid NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','early','late','maybe_late','uncertain','cancelled')),
  late_minutes integer CHECK (late_minutes IS NULL OR late_minutes BETWEEN 1 AND 1440),
  message text NOT NULL DEFAULT '' CHECK (char_length(message) <= 300),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (party_id,user_id),
  CHECK (status IN ('late','maybe_late') OR late_minutes IS NULL)
);
ALTER TABLE public.party_attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members read party attendance" ON public.party_attendance;
CREATE POLICY "Members read party attendance" ON public.party_attendance FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Members submit own attendance" ON public.party_attendance;
CREATE POLICY "Members submit own attendance" ON public.party_attendance FOR INSERT TO authenticated
WITH CHECK (user_id=auth.uid() AND (
  EXISTS (SELECT 1 FROM public.party_slots s WHERE s.party_id=party_attendance.party_id AND s.user_id=auth.uid()) OR
  EXISTS (SELECT 1 FROM public.party_waitlist w WHERE w.party_id=party_attendance.party_id AND w.user_id=auth.uid())
));
DROP POLICY IF EXISTS "Members edit own attendance" ON public.party_attendance;
CREATE POLICY "Members edit own attendance" ON public.party_attendance FOR UPDATE TO authenticated
USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());
CREATE INDEX IF NOT EXISTS party_attendance_updated_idx ON public.party_attendance(party_id,updated_at DESC);
