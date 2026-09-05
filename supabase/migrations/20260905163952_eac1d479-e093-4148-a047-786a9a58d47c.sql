DROP POLICY IF EXISTS suggestions_select ON public.suggestions;
CREATE POLICY suggestions_select ON public.suggestions
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