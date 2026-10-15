-- Self-reported MVP participation, separate from the person reporting a timer.
-- Existing historical timers are deliberately not awarded as kills.
ALTER TABLE public.mvp_kills ADD COLUMN IF NOT EXISTS killer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS mvp_kills_killer_idx ON public.mvp_kills(killer_id) WHERE killer_id IS NOT NULL;
-- Enforce self-credit only (the existing reporter owns the report).
ALTER TABLE public.mvp_kills DROP CONSTRAINT IF EXISTS mvp_kills_self_credit_only;
ALTER TABLE public.mvp_kills ADD CONSTRAINT mvp_kills_self_credit_only CHECK (killer_id IS NULL OR killer_id=reporter_id);
