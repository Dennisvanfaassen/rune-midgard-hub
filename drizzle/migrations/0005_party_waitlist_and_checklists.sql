-- Party signup queue, reusable preparation checklists, and atomic promotion.
ALTER TABLE public.parties ADD COLUMN IF NOT EXISTS signup_mode text NOT NULL DEFAULT 'core' CHECK (signup_mode IN ('core','open'));
ALTER TABLE public.parties ADD COLUMN IF NOT EXISTS checklist jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.party_templates ADD COLUMN IF NOT EXISTS checklist jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.party_templates ADD COLUMN IF NOT EXISTS signup_mode text NOT NULL DEFAULT 'core' CHECK (signup_mode IN ('core','open'));
CREATE TABLE IF NOT EXISTS public.party_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job text NOT NULL,
  char_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (party_id,user_id)
);
CREATE INDEX IF NOT EXISTS party_waitlist_fifo ON public.party_waitlist(party_id,created_at,id);
GRANT SELECT ON public.party_waitlist TO anon,authenticated;
GRANT ALL ON public.party_waitlist TO service_role;
ALTER TABLE public.party_waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "waitlist readable" ON public.party_waitlist FOR SELECT TO anon,authenticated USING (true);

CREATE OR REPLACE FUNCTION public.party_job_matches(p_role text,p_job text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT p_role IN ('Any','Tank','Mobber','Tapper','SP','Bragi','Other') OR p_role=p_job
$$;
CREATE OR REPLACE FUNCTION public.party_promote(_party uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s record; w record; mode text;
BEGIN
 SELECT signup_mode INTO mode FROM public.parties WHERE id=_party FOR UPDATE;
 IF mode IS NULL THEN RETURN; END IF;
 FOR s IN SELECT id,role FROM public.party_slots WHERE party_id=_party AND user_id IS NULL ORDER BY position FOR UPDATE LOOP
   SELECT * INTO w FROM public.party_waitlist
   WHERE party_id=_party AND (mode='open' OR public.party_job_matches(s.role,job))
   ORDER BY created_at,id LIMIT 1 FOR UPDATE;
   IF FOUND THEN
     UPDATE public.party_slots SET user_id=w.user_id,job=w.job,char_name=w.char_name WHERE id=s.id AND user_id IS NULL;
     DELETE FROM public.party_waitlist WHERE id=w.id;
   END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.party_promote(uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.party_signup(_party uuid,_job text,_char_name text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_user uuid := auth.uid(); v_mode text; v_slot uuid;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=v_user) THEN RAISE EXCEPTION 'Profile missing'; END IF;
 SELECT signup_mode INTO v_mode FROM public.parties WHERE id=_party AND starts_at > now() FOR UPDATE;
 IF v_mode IS NULL THEN RAISE EXCEPTION 'Party not found or already started'; END IF;
 IF EXISTS(SELECT 1 FROM public.party_slots WHERE party_id=_party AND user_id=v_user) THEN RETURN 'joined'; END IF;
 IF EXISTS(SELECT 1 FROM public.party_waitlist WHERE party_id=_party AND user_id=v_user) THEN RETURN 'waitlisted'; END IF;
 -- Existing reserves always have first claim over a new signup.
 PERFORM public.party_promote(_party);
 SELECT id INTO v_slot FROM public.party_slots WHERE party_id=_party AND user_id IS NULL
   AND (v_mode='open' OR public.party_job_matches(role,_job))
   ORDER BY position LIMIT 1 FOR UPDATE;
 IF v_slot IS NOT NULL THEN
   UPDATE public.party_slots SET user_id=v_user,job=left(_job,80),char_name=left(coalesce(_char_name,''),80) WHERE id=v_slot;
   RETURN 'joined';
 END IF;
 INSERT INTO public.party_waitlist(party_id,user_id,job,char_name) VALUES(_party,v_user,left(_job,80),left(coalesce(_char_name,''),80));
 RETURN 'waitlisted';
END $$;
GRANT EXECUTE ON FUNCTION public.party_signup(uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.party_leave(_party uuid,_member uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_user uuid:=auth.uid(); target uuid; owner uuid;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
 SELECT creator_id INTO owner FROM public.parties WHERE id=_party FOR UPDATE;
 IF owner IS NULL THEN RAISE EXCEPTION 'Party not found'; END IF;
 target:=coalesce(_member,v_user);
 IF target<>v_user AND owner<>v_user THEN RAISE EXCEPTION 'Not authorized'; END IF;
 DELETE FROM public.party_waitlist WHERE party_id=_party AND user_id=target;
 UPDATE public.party_slots SET user_id=NULL,job=NULL,char_name=NULL WHERE party_id=_party AND user_id=target;
 PERFORM public.party_promote(_party);
END $$;
GRANT EXECUTE ON FUNCTION public.party_leave(uuid,uuid) TO authenticated;
-- Prevent bypassing the queue through direct client writes.
DROP POLICY IF EXISTS "claim or edit slots" ON public.party_slots;
CREATE POLICY "creator edits slots" ON public.party_slots FOR UPDATE TO authenticated USING(public.is_party_creator(party_id)) WITH CHECK(public.is_party_creator(party_id));
