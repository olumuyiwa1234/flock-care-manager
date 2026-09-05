CREATE OR REPLACE FUNCTION app.is_leader(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles r
    JOIN public.profiles p ON p.id = r.user_id
    WHERE r.user_id = _user_id
      AND p.approval_status = 'approved'
      AND r.role IN ('pastorate','it_infrastructure','hod','group_leader','follow_up')
  )
$$;
REVOKE ALL ON FUNCTION app.is_leader(uuid) FROM PUBLIC, anon, authenticated;

CREATE TABLE public.suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name text NOT NULL DEFAULT '',
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suggestions TO authenticated;
GRANT ALL ON public.suggestions TO service_role;
ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY suggestions_insert ON public.suggestions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY suggestions_select ON public.suggestions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR app.is_leader(auth.uid()));
CREATE POLICY suggestions_update_own ON public.suggestions FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY suggestions_delete ON public.suggestions FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR app.has_full_access(auth.uid()));

CREATE TABLE public.pastor_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name text NOT NULL DEFAULT '',
  subject text,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pastor_messages TO authenticated;
GRANT ALL ON public.pastor_messages TO service_role;
ALTER TABLE public.pastor_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY pastor_messages_insert ON public.pastor_messages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY pastor_messages_select ON public.pastor_messages FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR app.has_role(auth.uid(), 'pastorate'::public.app_role));
CREATE POLICY pastor_messages_update_own ON public.pastor_messages FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY pastor_messages_delete ON public.pastor_messages FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR app.has_role(auth.uid(), 'pastorate'::public.app_role));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER suggestions_updated_at BEFORE UPDATE ON public.suggestions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER pastor_messages_updated_at BEFORE UPDATE ON public.pastor_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS member_photos_read ON storage.objects;
CREATE POLICY member_photos_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'member-photos' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR app.is_leader(auth.uid())
    OR EXISTS (SELECT 1 FROM public.members m
               WHERE m.photo_url = objects.name AND app.can_see_member(auth.uid(), m.id))));
