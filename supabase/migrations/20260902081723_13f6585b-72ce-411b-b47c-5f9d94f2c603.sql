-- 1. Drop dependent policies
DROP POLICY IF EXISTS members_select ON public.members;
DROP POLICY IF EXISTS members_insert ON public.members;
DROP POLICY IF EXISTS members_update ON public.members;
DROP POLICY IF EXISTS members_delete ON public.members;
DROP POLICY IF EXISTS attendance_select ON public.attendance;
DROP POLICY IF EXISTS attendance_insert ON public.attendance;
DROP POLICY IF EXISTS attendance_update ON public.attendance;
DROP POLICY IF EXISTS attendance_delete ON public.attendance;
DROP POLICY IF EXISTS follow_ups_select ON public.follow_ups;
DROP POLICY IF EXISTS follow_ups_insert ON public.follow_ups;
DROP POLICY IF EXISTS follow_ups_update ON public.follow_ups;
DROP POLICY IF EXISTS follow_ups_delete ON public.follow_ups;
DROP POLICY IF EXISTS settings_select ON public.church_settings;
DROP POLICY IF EXISTS settings_insert ON public.church_settings;
DROP POLICY IF EXISTS settings_update ON public.church_settings;
DROP POLICY IF EXISTS settings_delete ON public.church_settings;
DROP POLICY IF EXISTS profiles_select_own_or_staff ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
DROP POLICY IF EXISTS user_roles_select_own_or_staff ON public.user_roles;
DROP POLICY IF EXISTS member_photos_read ON storage.objects;
DROP POLICY IF EXISTS member_photos_update ON storage.objects;
DROP POLICY IF EXISTS member_photos_delete ON storage.objects;

DROP FUNCTION IF EXISTS app.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS app.has_full_access(uuid);
DROP FUNCTION IF EXISTS app.my_department(uuid);
DROP FUNCTION IF EXISTS app.is_children_leader(uuid);

-- 2. New role enum
ALTER TYPE public.app_role RENAME TO app_role_old;
CREATE TYPE public.app_role AS ENUM ('pastorate','hod','group_leader','member','it_infrastructure','follow_up');

ALTER TABLE public.user_roles
  ALTER COLUMN role TYPE public.app_role
  USING (CASE role::text
    WHEN 'senior_pastor' THEN 'pastorate'
    WHEN 'follow_up_team' THEN 'follow_up'
    WHEN 'attendance_officer' THEN 'follow_up'
    WHEN 'department_leader' THEN 'hod'
    ELSE 'member' END)::public.app_role;

DROP TYPE public.app_role_old;

-- 3. Profile changes
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sub_role text,
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id);

UPDATE public.profiles SET approval_status = 'approved', approved_at = now() WHERE approval_status <> 'approved';
UPDATE public.profiles p SET sub_role = p.department WHERE sub_role IS NULL AND p.department IS NOT NULL;
UPDATE public.profiles p SET sub_role = 'Pastor'
  WHERE sub_role IS NULL AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id AND r.role = 'pastorate');

-- 4. Age brackets
UPDATE public.members SET age_bracket = '13-17' WHERE age_bracket = 'Under 18';

-- 5. Helper functions
CREATE OR REPLACE FUNCTION app.is_approved(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _user_id AND p.approval_status = 'approved')
$$;

CREATE OR REPLACE FUNCTION app.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles r
    JOIN public.profiles p ON p.id = r.user_id
    WHERE r.user_id = _user_id AND r.role = _role AND p.approval_status = 'approved'
  )
$$;

CREATE OR REPLACE FUNCTION app.has_full_access(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT app.has_role(_user_id, 'pastorate'::public.app_role)
      OR app.has_role(_user_id, 'it_infrastructure'::public.app_role)
$$;

CREATE OR REPLACE FUNCTION app.is_follow_up(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT app.has_role(_user_id, 'follow_up'::public.app_role)
$$;

CREATE OR REPLACE FUNCTION app.my_sub_role(_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.sub_role FROM public.profiles p
  WHERE p.id = _user_id AND p.approval_status = 'approved'
$$;

-- Fellowship derived from marital status, gender and age bracket
CREATE OR REPLACE FUNCTION app.fellowship_of(_gender text, _marital text, _bracket text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN _bracket = '50 and Above' THEN 'Elders Fellowship'
    WHEN _bracket IN ('0-12','13-17') THEN NULL
    WHEN _marital = 'Married' AND _gender = 'Male' THEN 'Men''s Fellowship'
    WHEN _marital IN ('Married','Widowed') AND _gender = 'Female' THEN 'Good Women Fellowship'
    WHEN _marital IS DISTINCT FROM 'Married' THEN 'Youth Fellowship'
    ELSE NULL END
$$;

-- Can the user see this member through their cluster?
CREATE OR REPLACE FUNCTION app.in_my_cluster(_user_id uuid, _department text, _gender text, _marital text, _bracket text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN app.has_role(_user_id, 'hod'::public.app_role) THEN
      CASE WHEN app.my_sub_role(_user_id) = 'Children'
           THEN _bracket IN ('0-12','13-17')
           ELSE _department IS NOT DISTINCT FROM app.my_sub_role(_user_id) END
    WHEN app.has_role(_user_id, 'group_leader'::public.app_role) THEN
      app.fellowship_of(_gender, _marital, _bracket) IS NOT DISTINCT FROM app.my_sub_role(_user_id)
    ELSE false END
$$;

CREATE OR REPLACE FUNCTION app.can_see_member(_user_id uuid, _member_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = _member_id
      AND (app.has_full_access(_user_id)
        OR app.is_follow_up(_user_id)
        OR m.user_id = _user_id
        OR m.created_by = _user_id
        OR app.in_my_cluster(_user_id, m.department, m.gender, m.marital_status, m.age_bracket))
  )
$$;

CREATE OR REPLACE FUNCTION app.can_mark_member(_user_id uuid, _member_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = _member_id
      AND (app.has_full_access(_user_id)
        OR app.is_follow_up(_user_id)
        OR app.in_my_cluster(_user_id, m.department, m.gender, m.marital_status, m.age_bracket))
  )
$$;

REVOKE ALL ON FUNCTION app.is_approved(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.has_full_access(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.is_follow_up(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.my_sub_role(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.fellowship_of(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.in_my_cluster(uuid, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.can_see_member(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.can_mark_member(uuid, uuid) FROM PUBLIC;

-- 6. Signup handler (no access code)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  requested text := coalesce(NEW.raw_user_meta_data->>'role','member');
  sub text := NEW.raw_user_meta_data->>'sub_role';
  final_role public.app_role;
  status text;
BEGIN
  IF requested IN ('pastorate','hod','group_leader','member','it_infrastructure','follow_up') THEN
    final_role := requested::public.app_role;
  ELSE
    final_role := 'member';
  END IF;

  IF final_role = 'member' OR (final_role = 'pastorate' AND sub = 'Pastor') THEN
    status := 'approved';
  ELSE
    status := 'pending';
  END IF;

  INSERT INTO public.profiles (id, full_name, phone, department, sub_role, approval_status, approved_at)
  VALUES (NEW.id,
          coalesce(NEW.raw_user_meta_data->>'full_name',''),
          NEW.raw_user_meta_data->>'phone',
          NEW.raw_user_meta_data->>'department',
          sub,
          status,
          CASE WHEN status = 'approved' THEN now() ELSE NULL END);

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, final_role)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$function$;

-- 7. Policies
CREATE POLICY profiles_select_own_or_staff ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR app.has_full_access(auth.uid()));
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY profiles_update_approval ON public.profiles FOR UPDATE TO authenticated
  USING (app.has_role(auth.uid(), 'pastorate'::public.app_role))
  WITH CHECK (app.has_role(auth.uid(), 'pastorate'::public.app_role));

CREATE POLICY user_roles_select_own_or_staff ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR app.has_full_access(auth.uid()));

CREATE POLICY members_select ON public.members FOR SELECT TO authenticated
  USING (app.has_full_access(auth.uid())
      OR app.is_follow_up(auth.uid())
      OR user_id = auth.uid()
      OR created_by = auth.uid()
      OR app.in_my_cluster(auth.uid(), department, gender, marital_status, age_bracket));
CREATE POLICY members_insert ON public.members FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND (user_id IS NULL OR user_id = auth.uid()));
CREATE POLICY members_update ON public.members FOR UPDATE TO authenticated
  USING (app.has_full_access(auth.uid()) OR user_id = auth.uid())
  WITH CHECK (app.has_full_access(auth.uid()) OR user_id = auth.uid());
CREATE POLICY members_delete ON public.members FOR DELETE TO authenticated
  USING (app.has_full_access(auth.uid()));

CREATE POLICY attendance_select ON public.attendance FOR SELECT TO authenticated
  USING (app.can_see_member(auth.uid(), member_id));
CREATE POLICY attendance_insert ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND app.can_see_member(auth.uid(), member_id));
CREATE POLICY attendance_update ON public.attendance FOR UPDATE TO authenticated
  USING (app.can_mark_member(auth.uid(), member_id))
  WITH CHECK (app.can_mark_member(auth.uid(), member_id));
CREATE POLICY attendance_delete ON public.attendance FOR DELETE TO authenticated
  USING (app.has_full_access(auth.uid()));

CREATE POLICY follow_ups_select ON public.follow_ups FOR SELECT TO authenticated
  USING (app.can_mark_member(auth.uid(), member_id));
CREATE POLICY follow_ups_insert ON public.follow_ups FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND app.can_mark_member(auth.uid(), member_id));
CREATE POLICY follow_ups_update ON public.follow_ups FOR UPDATE TO authenticated
  USING (app.has_full_access(auth.uid())) WITH CHECK (app.has_full_access(auth.uid()));
CREATE POLICY follow_ups_delete ON public.follow_ups FOR DELETE TO authenticated
  USING (app.has_full_access(auth.uid()));

CREATE POLICY settings_select ON public.church_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY settings_insert ON public.church_settings FOR INSERT TO authenticated
  WITH CHECK (app.has_full_access(auth.uid()));
CREATE POLICY settings_update ON public.church_settings FOR UPDATE TO authenticated
  USING (app.has_full_access(auth.uid())) WITH CHECK (app.has_full_access(auth.uid()));
CREATE POLICY settings_delete ON public.church_settings FOR DELETE TO authenticated
  USING (app.has_full_access(auth.uid()));

CREATE POLICY member_photos_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'member-photos' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR app.has_full_access(auth.uid())
    OR EXISTS (SELECT 1 FROM public.members m
               WHERE m.photo_url = objects.name AND app.can_see_member(auth.uid(), m.id))));

CREATE POLICY member_photos_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'member-photos' AND ((storage.foldername(name))[1] = auth.uid()::text OR app.has_full_access(auth.uid())))
  WITH CHECK (bucket_id = 'member-photos' AND ((storage.foldername(name))[1] = auth.uid()::text OR app.has_full_access(auth.uid())));

CREATE POLICY member_photos_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'member-photos' AND ((storage.foldername(name))[1] = auth.uid()::text OR app.has_full_access(auth.uid())));
