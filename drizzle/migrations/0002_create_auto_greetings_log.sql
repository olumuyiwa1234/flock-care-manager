-- Tracks which automatic celebration greetings have already been sent,
-- so the scheduled job never sends the same greeting twice for the same day.
CREATE TABLE public.auto_greetings_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  occasion TEXT NOT NULL,
  celebrated_on DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (member_id, occasion, celebrated_on)
);

-- Only the server (service role) reads/writes this log; regular users never touch it.
GRANT ALL ON public.auto_greetings_log TO service_role;

ALTER TABLE public.auto_greetings_log ENABLE ROW LEVEL SECURITY;