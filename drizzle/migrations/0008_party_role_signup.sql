-- Run in Supabase SQL Editor. Changes signup to selected slots, never profile class.
-- Keeps the existing 12-slot cap and party_leave/party_promote workflows.
CREATE OR REPLACE FUNCTION public.party_signup_role(
  _party uuid,
  _slot uuid DEFAULT NULL,
  _waitlist_role text DEFAULT 'Any',
  _char_name text DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_party public.parties%ROWTYPE;
  v_slot public.party_slots%ROWTYPE;
  v_job text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to join a party'; END IF;
  -- Serialize signups, cancellations and waitlist transitions per party.
  SELECT * INTO v_party FROM public.parties WHERE id=_party FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Party not found'; END IF;
  IF v_party.starts_at < now() - interval '4 hours' THEN RAISE EXCEPTION 'Party has ended'; END IF;
  IF EXISTS(SELECT 1 FROM public.party_slots WHERE party_id=_party AND user_id=auth.uid())
     OR EXISTS(SELECT 1 FROM public.party_waitlist WHERE party_id=_party AND user_id=auth.uid()) THEN
    RAISE EXCEPTION 'You are already signed up or on the substitute list';
  END IF;
  -- Store the actual profile class separately for display only. Never use it for role eligibility.
  SELECT job INTO v_job FROM public.profiles WHERE id=auth.uid();
  IF _slot IS NOT NULL THEN
    SELECT * INTO v_slot FROM public.party_slots
      WHERE id=_slot AND party_id=_party FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'The selected slot does not exist'; END IF;
    IF v_slot.user_id IS NULL THEN
      UPDATE public.party_slots
         SET user_id=auth.uid(), job=coalesce(v_job,'Novice'), char_name=nullif(trim(_char_name),'')
       WHERE id=_slot AND user_id IS NULL;
      RETURN 'joined';
    END IF;
    -- Selected slot was taken meanwhile: offer the substitute list instead.
  ELSE
    -- Explicit substitute sign-up is allowed even while slots are open.
    NULL;
  END IF;
  INSERT INTO public.party_waitlist(party_id,user_id,job,char_name)
    VALUES (_party,auth.uid(),
      CASE WHEN _slot IS NOT NULL THEN v_slot.role ELSE left(coalesce(nullif(trim(_waitlist_role),''),'Any'),80) END,
      nullif(trim(_char_name),''));
  RETURN 'waitlisted';
END; $$;
REVOKE ALL ON FUNCTION public.party_signup_role(uuid,uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.party_signup_role(uuid,uuid,text,text) TO authenticated;

-- Promotion no longer compares profile classes to slots. A substitute who
-- volunteered for the vacated role gets priority; otherwise use FIFO.
CREATE OR REPLACE FUNCTION public.party_promote(_party uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_slot public.party_slots%ROWTYPE;
        v_wait public.party_waitlist%ROWTYPE;
        v_actual_job text;
BEGIN
  PERFORM 1 FROM public.parties WHERE id=_party FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  FOR v_slot IN SELECT * FROM public.party_slots
      WHERE party_id=_party AND user_id IS NULL ORDER BY position FOR UPDATE LOOP
    SELECT * INTO v_wait FROM public.party_waitlist
      WHERE party_id=_party
      ORDER BY CASE WHEN job=v_slot.role OR v_slot.role='Any' OR job='Any' THEN 0 ELSE 1 END,
               created_at, id LIMIT 1 FOR UPDATE;
    IF NOT FOUND THEN RETURN; END IF;
    SELECT job INTO v_actual_job FROM public.profiles WHERE id=v_wait.user_id;
    DELETE FROM public.party_waitlist WHERE id=v_wait.id;
    UPDATE public.party_slots SET user_id=v_wait.user_id,
      job=coalesce(v_actual_job,'Novice'),char_name=v_wait.char_name
      WHERE id=v_slot.id AND user_id IS NULL;
  END LOOP;
END; $$;
REVOKE ALL ON FUNCTION public.party_promote(uuid) FROM PUBLIC;
-- Only server/database triggers should call promotion.
