CREATE OR REPLACE FUNCTION app.is_my_member_row(_user_id uuid, _member_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = _member_id AND m.user_id = _user_id
  )
$$;

REVOKE ALL ON FUNCTION app.is_my_member_row(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.is_my_member_row(uuid, uuid) TO authenticated;

CREATE TABLE public.greetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_name text NOT NULL DEFAULT '',
  recipient_member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  occasion text NOT NULL DEFAULT 'birthday',
  message text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX greetings_recipient_idx ON public.greetings (recipient_member_id, created_at DESC);
CREATE INDEX greetings_sender_idx ON public.greetings (sender_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.greetings TO authenticated;
GRANT ALL ON public.greetings TO service_role;

ALTER TABLE public.greetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY greetings_insert ON public.greetings
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY greetings_select ON public.greetings
  FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR app.is_my_member_row(auth.uid(), recipient_member_id));

CREATE POLICY greetings_update_own ON public.greetings
  FOR UPDATE TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY greetings_delete ON public.greetings
  FOR DELETE TO authenticated
  USING (sender_id = auth.uid() OR app.has_full_access(auth.uid()));

CREATE TRIGGER greetings_updated_at
  BEFORE UPDATE ON public.greetings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();