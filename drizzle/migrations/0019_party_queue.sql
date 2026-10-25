-- Apply once through the Lovable Cloud SQL editor, after 0000 and 0009.
-- Membership follows the existing hub: a signed-in account with a profile.
-- No service key, client-provided identity, or client-side clock is trusted.
BEGIN;

CREATE TABLE public.party_queue (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  char_name text NOT NULL CHECK (char_length(char_name) BETWEEN 1 AND 40),
  job text NOT NULL CHECK (job IN (
    'Novice','Swordman','Mage','Archer','Acolyte','Merchant','Thief',
    'Knight','Priest','Wizard','Blacksmith','Hunter','Assassin',
    'Crusader','Monk','Sage','Rogue','Alchemist','Bard','Dancer'
  )),
  base_lv integer NOT NULL CHECK (base_lv BETWEEN 1 AND 99),
  activity text NOT NULL CHECK (activity IN ('Any','Leveling','Farming','MVP')),
  role text NOT NULL CHECK (role IN ('Any','Tank','Mobber','Tapper','Trapper','Greed','SP','Bragi','Other')),
  location text NOT NULL DEFAULT '' CHECK (char_length(location) <= 80),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 240),
  joined_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '1 hour'
);
CREATE INDEX party_queue_expiry_idx ON public.party_queue(expires_at);
ALTER TABLE public.party_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.party_queue FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.party_queue TO authenticated;
GRANT ALL ON public.party_queue TO service_role;
-- Read permission also covers inactive rows so Realtime can deliver leave updates.
-- The snapshot RPC only returns active entries.
CREATE POLICY "Guild profiles read queue" ON public.party_queue
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()))
  );

-- The profile lock serializes join/leave/extend for each account, even across tabs.
-- A retry of a live join returns the same entry and does not emit another alert.
CREATE FUNCTION public.party_queue_join(p_activity text, p_role text, p_location text, p_note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE person public.profiles; previous public.party_queue; result uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to join the queue'; END IF;
  SELECT * INTO person FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Create your guild profile first'; END IF;
  SELECT * INTO previous FROM public.party_queue WHERE user_id = auth.uid();
  IF previous.expires_at > now() THEN RETURN previous.id; END IF;
  IF previous.joined_at > now() - interval '15 seconds' THEN
    RAISE EXCEPTION 'Please wait 15 seconds before rejoining';
  END IF;
  IF coalesce(btrim(person.char_name), '') = '' OR char_length(btrim(person.char_name)) > 40 THEN
    RAISE EXCEPTION 'Set a character name of 1 to 40 characters in your profile';
  END IF;
  IF person.job NOT IN ('Novice','Swordman','Mage','Archer','Acolyte','Merchant','Thief',
    'Knight','Priest','Wizard','Blacksmith','Hunter','Assassin','Crusader','Monk','Sage','Rogue','Alchemist','Bard','Dancer') THEN
    RAISE EXCEPTION 'The queue supports Episode 6 classes through 2-2';
  END IF;
  IF person.base_lv NOT BETWEEN 1 AND 99 THEN RAISE EXCEPTION 'Set a base level from 1 to 99 in your profile'; END IF;
  IF p_activity IS NULL OR p_activity NOT IN ('Any','Leveling','Farming','MVP')
    OR p_role IS NULL OR p_role NOT IN ('Any','Tank','Mobber','Tapper','Trapper','Greed','SP','Bragi','Other')
    OR p_location IS NULL OR char_length(p_location) > 80
    OR p_note IS NULL OR char_length(p_note) > 240 THEN
    RAISE EXCEPTION 'Check your activity, role, destination and note';
  END IF;
  INSERT INTO public.party_queue(user_id,char_name,job,base_lv,activity,role,location,note)
    VALUES(auth.uid(),btrim(person.char_name),person.job,person.base_lv,p_activity,p_role,btrim(p_location),btrim(p_note))
    ON CONFLICT(user_id) DO UPDATE SET
      id=gen_random_uuid(),char_name=excluded.char_name,job=excluded.job,base_lv=excluded.base_lv,
      activity=excluded.activity,role=excluded.role,location=excluded.location,note=excluded.note,
      joined_at=now(),expires_at=now()+interval '1 hour'
    RETURNING id INTO result;
  RETURN result;
END; $$;

CREATE FUNCTION public.party_queue_leave(p_entry_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to leave the queue'; END IF;
  PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR UPDATE;
  -- Entry ID prevents a delayed leave from cancelling a later join.
  UPDATE public.party_queue SET expires_at=least(expires_at,now()) WHERE user_id=auth.uid() AND id=p_entry_id;
END; $$;

CREATE FUNCTION public.party_queue_extend(p_entry_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to extend your queue'; END IF;
  PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR UPDATE;
  UPDATE public.party_queue SET expires_at=now()+interval '1 hour'
    WHERE user_id=auth.uid() AND id=p_entry_id AND expires_at>now();
  IF NOT FOUND THEN RAISE EXCEPTION 'Your queue has expired. Join again when ready'; END IF;
END; $$;

CREATE FUNCTION public.party_queue_snapshot()
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid()) THEN
    RAISE EXCEPTION 'A signed-in guild profile is required';
  END IF;
  RETURN jsonb_build_object('server_time',now(),'entries',coalesce(
    (SELECT jsonb_agg(to_jsonb(q) ORDER BY q.joined_at) FROM public.party_queue q WHERE q.expires_at>now()),'[]'::jsonb));
END; $$;

REVOKE ALL ON FUNCTION public.party_queue_join(text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.party_queue_leave(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.party_queue_extend(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.party_queue_snapshot() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.party_queue_join(text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.party_queue_leave(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.party_queue_extend(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.party_queue_snapshot() TO authenticated;

-- Publication may be absent in local PostgreSQL. Polling remains a fallback.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime')
    AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='party_queue') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.party_queue;
  END IF;
END $$;
COMMIT;
