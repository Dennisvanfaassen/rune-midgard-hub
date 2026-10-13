CREATE TABLE public.forum_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('guides','builds','general','trading','off-topic')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 20000),
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_post_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.forum_threads TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forum_threads TO authenticated;
GRANT ALL ON public.forum_threads TO service_role;
ALTER TABLE public.forum_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "threads readable" ON public.forum_threads FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "own thread insert" ON public.forum_threads FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id AND pinned = false);
CREATE POLICY "own thread update" ON public.forum_threads FOR UPDATE TO authenticated USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
CREATE POLICY "own thread delete" ON public.forum_threads FOR DELETE TO authenticated USING (auth.uid() = author_id);

CREATE TABLE public.forum_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.forum_threads(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 10000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX forum_posts_thread_idx ON public.forum_posts(thread_id, created_at);
GRANT SELECT ON public.forum_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forum_posts TO authenticated;
GRANT ALL ON public.forum_posts TO service_role;
ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts readable" ON public.forum_posts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "own post insert" ON public.forum_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "own post update" ON public.forum_posts FOR UPDATE TO authenticated USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
CREATE POLICY "own post delete" ON public.forum_posts FOR DELETE TO authenticated USING (auth.uid() = author_id);

CREATE OR REPLACE FUNCTION public.bump_thread() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.forum_threads SET last_post_at = now() WHERE id = NEW.thread_id;
  RETURN NEW;
END $$;
CREATE TRIGGER forum_post_bump AFTER INSERT ON public.forum_posts FOR EACH ROW EXECUTE FUNCTION public.bump_thread();

CREATE TABLE public.wishlist_help (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wishlist_id uuid NOT NULL REFERENCES public.gear_wishlist(id) ON DELETE CASCADE,
  helper_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('have','help')),
  message text CHECK (message IS NULL OR char_length(message) <= 300),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wishlist_id, helper_id)
);
GRANT SELECT ON public.wishlist_help TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wishlist_help TO authenticated;
GRANT ALL ON public.wishlist_help TO service_role;
ALTER TABLE public.wishlist_help ENABLE ROW LEVEL SECURITY;
CREATE POLICY "help readable" ON public.wishlist_help FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "own help insert" ON public.wishlist_help FOR INSERT TO authenticated WITH CHECK (auth.uid() = helper_id AND NOT EXISTS (SELECT 1 FROM public.gear_wishlist g WHERE g.id = wishlist_id AND g.user_id = auth.uid()));
CREATE POLICY "own help update" ON public.wishlist_help FOR UPDATE TO authenticated USING (auth.uid() = helper_id) WITH CHECK (auth.uid() = helper_id);
CREATE POLICY "helper or owner delete" ON public.wishlist_help FOR DELETE TO authenticated USING (auth.uid() = helper_id OR EXISTS (SELECT 1 FROM public.gear_wishlist g WHERE g.id = wishlist_id AND g.user_id = auth.uid()));

CREATE TABLE public.market_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  item_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 30000),
  price bigint NOT NULL CHECK (price BETWEEN 0 AND 1000000000000),
  note text CHECK (note IS NULL OR char_length(note) <= 500),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reserved','sold')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.market_listings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_listings TO authenticated;
GRANT ALL ON public.market_listings TO service_role;
ALTER TABLE public.market_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "listings readable" ON public.market_listings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "own listing insert" ON public.market_listings FOR INSERT TO authenticated WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "own listing update" ON public.market_listings FOR UPDATE TO authenticated USING (auth.uid() = seller_id) WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "own listing delete" ON public.market_listings FOR DELETE TO authenticated USING (auth.uid() = seller_id);