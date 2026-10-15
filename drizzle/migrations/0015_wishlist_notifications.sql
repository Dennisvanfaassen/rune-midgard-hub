-- Run once in Lovable Cloud SQL editor after wishlist_help has been created.
CREATE TABLE IF NOT EXISTS public.guild_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 actor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('wishlist_have','wishlist_help')),
 wishlist_id uuid REFERENCES public.gear_wishlist(id) ON DELETE CASCADE,
 item_name text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 read_at timestamptz
);
CREATE INDEX IF NOT EXISTS guild_notifications_recipient_idx ON public.guild_notifications(recipient_id,created_at DESC);
ALTER TABLE public.guild_notifications ENABLE ROW LEVEL SECURITY;
GRANT SELECT, UPDATE ON public.guild_notifications TO authenticated;
CREATE POLICY "Members read own guild notifications" ON public.guild_notifications FOR SELECT TO authenticated USING (recipient_id=(SELECT auth.uid()));
CREATE POLICY "Members mark own notifications read" ON public.guild_notifications FOR UPDATE TO authenticated USING (recipient_id=(SELECT auth.uid())) WITH CHECK (recipient_id=(SELECT auth.uid()));
-- Security definer only creates notifications after valid wishlist_help writes.
CREATE OR REPLACE FUNCTION public.notify_wishlist_offer() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE wish record;
BEGIN
 IF TG_OP='UPDATE' AND NEW.kind IS NOT DISTINCT FROM OLD.kind THEN RETURN NEW; END IF;
 SELECT user_id,item_name INTO wish FROM public.gear_wishlist WHERE id=NEW.wishlist_id;
 IF FOUND AND wish.user_id <> NEW.helper_id THEN
  INSERT INTO public.guild_notifications(recipient_id,actor_id,kind,wishlist_id,item_name)
  VALUES(wish.user_id,NEW.helper_id,
    CASE WHEN NEW.kind='have' THEN 'wishlist_have' ELSE 'wishlist_help' END,
    NEW.wishlist_id, COALESCE(wish.item_name,'Wishlisted item'));
 END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS wishlist_offer_notification ON public.wishlist_help;
CREATE TRIGGER wishlist_offer_notification AFTER INSERT OR UPDATE OF kind ON public.wishlist_help
FOR EACH ROW EXECUTE FUNCTION public.notify_wishlist_offer();
