-- Existing wishlist entries start at quantity 1.
ALTER TABLE public.gear_wishlist
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1;
ALTER TABLE public.gear_wishlist
  DROP CONSTRAINT IF EXISTS gear_wishlist_quantity_check;
ALTER TABLE public.gear_wishlist
  ADD CONSTRAINT gear_wishlist_quantity_check CHECK (quantity BETWEEN 1 AND 9999);
