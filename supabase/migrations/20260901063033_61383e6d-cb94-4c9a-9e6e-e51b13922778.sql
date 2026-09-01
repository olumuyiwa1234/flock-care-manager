ALTER TABLE public.members ADD COLUMN IF NOT EXISTS birth_day integer;

CREATE OR REPLACE FUNCTION app.is_children_leader(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, app
AS $$
  SELECT app.has_role(_user_id, 'department_leader'::public.app_role)
     AND lower(coalesce(app.my_department(_user_id), '')) = 'children';
$$;

REVOKE ALL ON FUNCTION app.is_children_leader(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.is_children_leader(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS members_select ON public.members;
CREATE POLICY members_select ON public.members
FOR SELECT TO authenticated
USING (
  app.has_full_access(auth.uid())
  OR (app.has_role(auth.uid(), 'department_leader'::public.app_role) AND NOT (department IS DISTINCT FROM app.my_department(auth.uid())))
  OR (app.is_children_leader(auth.uid()) AND age_bracket = 'Under 18')
  OR user_id = auth.uid()
  OR created_by = auth.uid()
);

DROP POLICY IF EXISTS attendance_select ON public.attendance;
CREATE POLICY attendance_select ON public.attendance
FOR SELECT TO authenticated
USING (
  app.has_full_access(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = attendance.member_id
      AND (
        m.user_id = auth.uid()
        OR (app.has_role(auth.uid(), 'department_leader'::public.app_role) AND NOT (m.department IS DISTINCT FROM app.my_department(auth.uid())))
        OR (app.is_children_leader(auth.uid()) AND m.age_bracket = 'Under 18')
      )
  )
);

DROP POLICY IF EXISTS attendance_update ON public.attendance;
CREATE POLICY attendance_update ON public.attendance
FOR UPDATE TO authenticated
USING (
  app.has_full_access(auth.uid())
  OR (app.is_children_leader(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.members m WHERE m.id = attendance.member_id AND m.age_bracket = 'Under 18'
  ))
)
WITH CHECK (
  app.has_full_access(auth.uid())
  OR (app.is_children_leader(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.members m WHERE m.id = attendance.member_id AND m.age_bracket = 'Under 18'
  ))
);