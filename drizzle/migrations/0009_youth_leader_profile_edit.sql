-- Children HOD may edit members aged 0-12; Teens HOD may edit members aged 13-17.
-- Helper mirrors the existing app-schema security-definer pattern so the RLS
-- policies can check leadership without recursive access to user_roles.
CREATE OR REPLACE FUNCTION app.is_youth_leader(_user_id uuid, _bracket text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles r
    JOIN public.profiles p ON p.id = r.user_id
    WHERE r.user_id = _user_id
      AND r.role = 'hod'::public.app_role
      AND p.approval_status = 'approved'
      AND (
        ('Children' = ANY(app.csv_list(p.sub_role)) AND _bracket = '0-12')
        OR ('Teens' = ANY(app.csv_list(p.sub_role)) AND _bracket = '13-17')
      )
  )
$$;

-- Broaden the update policy: full access, the member's own login, or the
-- Children/Teens leader for that member's age bracket. The WITH CHECK also
-- stops a youth leader from moving a child into another age bracket.
DROP POLICY "members_update" ON public.members;
CREATE POLICY "members_update"
  ON public.members
  FOR UPDATE
  TO authenticated
  USING (
    app.has_full_access(auth.uid())
    OR (user_id = auth.uid())
    OR app.is_youth_leader(auth.uid(), age_bracket)
  )
  WITH CHECK (
    app.has_full_access(auth.uid())
    OR (user_id = auth.uid())
    OR app.is_youth_leader(auth.uid(), age_bracket)
  );