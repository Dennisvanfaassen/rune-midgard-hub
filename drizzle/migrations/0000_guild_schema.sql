CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT 'Adventurer',
  char_name text,
  job text NOT NULL DEFAULT 'Novice',
  base_lv int NOT NULL DEFAULT 1,
  job_lv int NOT NULL DEFAULT 1,
  bio text,
  stat_build jsonb,
  skill_build jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable" ON public.profiles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NULLIF(NEW.raw_user_meta_data->>'display_name',''), NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1), 'Adventurer'));
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.gear_wishlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  item_key text NOT NULL,
  item_name text NOT NULL,
  item_type text,
  status text NOT NULL DEFAULT 'need' CHECK (status IN ('have','need')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_key)
);
GRANT SELECT ON public.gear_wishlist TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gear_wishlist TO authenticated;
GRANT ALL ON public.gear_wishlist TO service_role;
ALTER TABLE public.gear_wishlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gear readable" ON public.gear_wishlist FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "own gear insert" ON public.gear_wishlist FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own gear update" ON public.gear_wishlist FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own gear delete" ON public.gear_wishlist FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL,
  title text NOT NULL,
  starts_at timestamptz NOT NULL,
  place text NOT NULL,
  notes text,
  template text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.parties TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parties TO authenticated;
GRANT ALL ON public.parties TO service_role;
ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parties readable" ON public.parties FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "own party insert" ON public.parties FOR INSERT TO authenticated WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "own party update" ON public.parties FOR UPDATE TO authenticated USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "own party delete" ON public.parties FOR DELETE TO authenticated USING (auth.uid() = creator_id);

CREATE TABLE public.party_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  position int NOT NULL,
  role text NOT NULL DEFAULT 'Any',
  user_id uuid,
  job text,
  char_name text,
  UNIQUE (party_id, position),
  UNIQUE (party_id, user_id)
);
GRANT SELECT ON public.party_slots TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.party_slots TO authenticated;
GRANT ALL ON public.party_slots TO service_role;
ALTER TABLE public.party_slots ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_party_creator(_party uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.parties WHERE id = _party AND creator_id = auth.uid())
$$;

CREATE POLICY "slots readable" ON public.party_slots FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "creator adds slots" ON public.party_slots FOR INSERT TO authenticated WITH CHECK (public.is_party_creator(party_id));
CREATE POLICY "creator deletes slots" ON public.party_slots FOR DELETE TO authenticated USING (public.is_party_creator(party_id));
CREATE POLICY "claim or edit slots" ON public.party_slots FOR UPDATE TO authenticated
  USING (user_id IS NULL OR user_id = auth.uid() OR public.is_party_creator(party_id))
  WITH CHECK (user_id IS NULL OR user_id = auth.uid() OR public.is_party_creator(party_id));

CREATE OR REPLACE FUNCTION public.enforce_party_size() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM public.party_slots WHERE party_id = NEW.party_id) >= 12 THEN
    RAISE EXCEPTION 'A party can have at most 12 members';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER party_size_limit BEFORE INSERT ON public.party_slots FOR EACH ROW EXECUTE FUNCTION public.enforce_party_size();