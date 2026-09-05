DROP POLICY IF EXISTS pastor_messages_select ON public.pastor_messages;
CREATE POLICY pastor_messages_select ON public.pastor_messages
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.user_roles r
    JOIN public.profiles p ON p.id = r.user_id
    WHERE r.user_id = auth.uid()
      AND r.role = 'pastorate'
      AND p.sub_role = 'Pastor'
      AND p.approval_status = 'approved'
  )
);