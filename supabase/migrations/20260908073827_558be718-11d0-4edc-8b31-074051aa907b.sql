ALTER TABLE public.pastor_messages
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.pastor_messages(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS pastor_messages_parent_id_idx ON public.pastor_messages(parent_id);

CREATE OR REPLACE FUNCTION app.thread_owner(_message_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT p.user_id FROM public.pastor_messages c
       JOIN public.pastor_messages p ON p.id = c.parent_id
      WHERE c.id = _message_id),
    (SELECT m.user_id FROM public.pastor_messages m WHERE m.id = _message_id)
  );
$$;

REVOKE ALL ON FUNCTION app.thread_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.thread_owner(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION app.is_approved_pastor(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles r
    JOIN public.profiles p ON p.id = r.user_id
    WHERE r.user_id = _user_id
      AND r.role = 'pastorate'::public.app_role
      AND 'Pastor' = ANY(app.csv_list(p.sub_role))
      AND p.approval_status = 'approved'
  );
$$;

REVOKE ALL ON FUNCTION app.is_approved_pastor(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.is_approved_pastor(uuid) TO authenticated;

DROP POLICY IF EXISTS pastor_messages_select ON public.pastor_messages;
CREATE POLICY pastor_messages_select ON public.pastor_messages
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (parent_id IS NOT NULL AND app.thread_owner(parent_id) = auth.uid())
    OR app.is_approved_pastor(auth.uid())
  );

DROP POLICY IF EXISTS pastor_messages_insert ON public.pastor_messages;
CREATE POLICY pastor_messages_insert ON public.pastor_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      parent_id IS NULL
      OR app.thread_owner(parent_id) = auth.uid()
      OR app.is_approved_pastor(auth.uid())
    )
  );