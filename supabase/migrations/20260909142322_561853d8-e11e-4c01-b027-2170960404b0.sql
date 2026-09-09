-- Devices registered for push notifications, one row per browser/phone install.
CREATE TABLE public.push_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL DEFAULT 'web',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast lookup of a person's devices.
CREATE INDEX push_tokens_user_id_idx ON public.push_tokens(user_id);

-- Data API access: signed-in people manage their own rows, server code manages all.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_tokens TO authenticated;
GRANT ALL ON public.push_tokens TO service_role;

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- Each person may only see and change their own registered devices.
CREATE POLICY "Users manage their own push tokens"
  ON public.push_tokens FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);