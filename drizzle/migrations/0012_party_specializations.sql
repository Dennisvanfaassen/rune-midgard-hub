-- Run once in Lovable Cloud SQL Editor after the earlier party migrations.
-- Stores a member's chosen specialization separately from party slots so
-- waitlist promotion does not lose their selection.
CREATE TABLE IF NOT EXISTS public.party_specializations (
  party_id uuid NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL,
  specialization text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (party_id,user_id),
  CHECK (char_length(specialization) BETWEEN 1 AND 80)
);
ALTER TABLE public.party_specializations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Party members can read specializations" ON public.party_specializations;
CREATE POLICY "Party members can read specializations"
ON public.party_specializations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Members can choose their party specialization" ON public.party_specializations;
CREATE POLICY "Members can choose their party specialization"
ON public.party_specializations AS spec FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND
 (EXISTS (SELECT 1 FROM public.party_slots s WHERE s.party_id=spec.party_id AND s.user_id=auth.uid())
  OR EXISTS (SELECT 1 FROM public.party_waitlist w WHERE w.party_id=spec.party_id AND w.user_id=auth.uid())));
DROP POLICY IF EXISTS "Members can update their party specialization" ON public.party_specializations;
CREATE POLICY "Members can update their party specialization"
ON public.party_specializations FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Members can remove their party specialization" ON public.party_specializations;
CREATE POLICY "Members can remove their party specialization"
ON public.party_specializations FOR DELETE TO authenticated USING (user_id = auth.uid());
