CREATE SCHEMA IF NOT EXISTS app;
REVOKE ALL ON SCHEMA app FROM PUBLIC;
GRANT USAGE ON SCHEMA app TO authenticated, service_role;

CREATE OR REPLACE FUNCTION app.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION app.has_full_access(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('senior_pastor','follow_up_team','attendance_officer')) $$;

CREATE OR REPLACE FUNCTION app.my_department(_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT department FROM public.profiles WHERE id = _user_id $$;

REVOKE ALL ON FUNCTION app.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.has_full_access(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.my_department(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app.has_full_access(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app.my_department(uuid) TO authenticated, service_role;

-- profiles
DROP POLICY IF EXISTS profiles_select_own_or_staff ON public.profiles;
CREATE POLICY profiles_select_own_or_staff ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR app.has_full_access(auth.uid()));

-- user_roles
DROP POLICY IF EXISTS user_roles_select_own_or_staff ON public.user_roles;
CREATE POLICY user_roles_select_own_or_staff ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR app.has_full_access(auth.uid()));

-- members
DROP POLICY IF EXISTS members_select ON public.members;
CREATE POLICY members_select ON public.members FOR SELECT TO authenticated
USING (
  app.has_full_access(auth.uid())
  OR (app.has_role(auth.uid(), 'department_leader') AND NOT (department IS DISTINCT FROM app.my_department(auth.uid())))
  OR user_id = auth.uid()
  OR created_by = auth.uid()
);

DROP POLICY IF EXISTS members_insert ON public.members;
CREATE POLICY members_insert ON public.members FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (user_id IS NULL OR user_id = auth.uid())
);

DROP POLICY IF EXISTS members_update ON public.members;
CREATE POLICY members_update ON public.members FOR UPDATE TO authenticated
USING (app.has_full_access(auth.uid()) OR user_id = auth.uid())
WITH CHECK (app.has_full_access(auth.uid()) OR user_id = auth.uid());

DROP POLICY IF EXISTS members_delete ON public.members;
CREATE POLICY members_delete ON public.members FOR DELETE TO authenticated
USING (app.has_role(auth.uid(), 'senior_pastor'));

-- attendance
DROP POLICY IF EXISTS attendance_select ON public.attendance;
CREATE POLICY attendance_select ON public.attendance FOR SELECT TO authenticated
USING (
  app.has_full_access(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = attendance.member_id
      AND (m.user_id = auth.uid()
        OR (app.has_role(auth.uid(), 'department_leader') AND NOT (m.department IS DISTINCT FROM app.my_department(auth.uid()))))
  )
);

DROP POLICY IF EXISTS attendance_update ON public.attendance;
CREATE POLICY attendance_update ON public.attendance FOR UPDATE TO authenticated
USING (app.has_full_access(auth.uid())) WITH CHECK (app.has_full_access(auth.uid()));

DROP POLICY IF EXISTS attendance_delete ON public.attendance;
CREATE POLICY attendance_delete ON public.attendance FOR DELETE TO authenticated
USING (app.has_role(auth.uid(), 'senior_pastor'));

-- follow_ups
DROP POLICY IF EXISTS follow_ups_select ON public.follow_ups;
CREATE POLICY follow_ups_select ON public.follow_ups FOR SELECT TO authenticated
USING (
  app.has_full_access(auth.uid())
  OR (app.has_role(auth.uid(), 'department_leader') AND EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = follow_ups.member_id
        AND NOT (m.department IS DISTINCT FROM app.my_department(auth.uid()))
  ))
);

DROP POLICY IF EXISTS follow_ups_insert ON public.follow_ups;
CREATE POLICY follow_ups_insert ON public.follow_ups FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    app.has_full_access(auth.uid())
    OR (app.has_role(auth.uid(), 'department_leader') AND EXISTS (
        SELECT 1 FROM public.members m
        WHERE m.id = follow_ups.member_id
          AND NOT (m.department IS DISTINCT FROM app.my_department(auth.uid()))
    ))
  )
);

DROP POLICY IF EXISTS follow_ups_update ON public.follow_ups;
CREATE POLICY follow_ups_update ON public.follow_ups FOR UPDATE TO authenticated
USING (app.has_full_access(auth.uid())) WITH CHECK (app.has_full_access(auth.uid()));

DROP POLICY IF EXISTS follow_ups_delete ON public.follow_ups;
CREATE POLICY follow_ups_delete ON public.follow_ups FOR DELETE TO authenticated
USING (app.has_role(auth.uid(), 'senior_pastor'));

-- church_settings
DROP POLICY IF EXISTS settings_insert ON public.church_settings;
CREATE POLICY settings_insert ON public.church_settings FOR INSERT TO authenticated
WITH CHECK (app.has_full_access(auth.uid()));
DROP POLICY IF EXISTS settings_update ON public.church_settings;
CREATE POLICY settings_update ON public.church_settings FOR UPDATE TO authenticated
USING (app.has_full_access(auth.uid())) WITH CHECK (app.has_full_access(auth.uid()));

DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.has_full_access(uuid);
DROP FUNCTION IF EXISTS public.my_department(uuid);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  code text := upper(coalesce(NEW.raw_user_meta_data->>'access_code',''));
  requested text := coalesce(NEW.raw_user_meta_data->>'role','floor_member');
  final_role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, department)
  VALUES (NEW.id,
          coalesce(NEW.raw_user_meta_data->>'full_name',''),
          NEW.raw_user_meta_data->>'phone',
          NEW.raw_user_meta_data->>'department');

  IF code = 'HOPEHALL' THEN
    final_role := 'senior_pastor';
  ELSIF requested IN ('attendance_officer','department_leader','floor_member') THEN
    final_role := requested::public.app_role;
  ELSE
    final_role := 'floor_member';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, final_role)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$function$;

-- storage: member-photos ownership
DROP POLICY IF EXISTS member_photos_read ON storage.objects;
DROP POLICY IF EXISTS member_photos_insert ON storage.objects;
DROP POLICY IF EXISTS member_photos_update ON storage.objects;

CREATE POLICY member_photos_read ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'member-photos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR app.has_full_access(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.photo_url = storage.objects.name
        AND (m.user_id = auth.uid()
          OR m.created_by = auth.uid()
          OR (app.has_role(auth.uid(), 'department_leader') AND NOT (m.department IS DISTINCT FROM app.my_department(auth.uid()))))
    )
  )
);

CREATE POLICY member_photos_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'member-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY member_photos_update ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'member-photos'
  AND ((storage.foldername(name))[1] = auth.uid()::text OR app.has_full_access(auth.uid()))
)
WITH CHECK (
  bucket_id = 'member-photos'
  AND ((storage.foldername(name))[1] = auth.uid()::text OR app.has_full_access(auth.uid()))
);