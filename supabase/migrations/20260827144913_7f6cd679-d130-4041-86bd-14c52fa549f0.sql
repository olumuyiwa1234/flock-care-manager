
CREATE TYPE public.app_role AS ENUM ('senior_pastor','attendance_officer','follow_up_team','department_leader','floor_member');

-- profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone text,
  department text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.has_full_access(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('senior_pastor','follow_up_team','attendance_officer')
  )
$$;

CREATE OR REPLACE FUNCTION public.my_department(_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT department FROM public.profiles WHERE id = _user_id
$$;

CREATE POLICY "profiles_select_own_or_staff" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_full_access(auth.uid()));
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "user_roles_select_own_or_staff" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_full_access(auth.uid()));

-- members
CREATE SEQUENCE public.member_code_seq START 1001;

CREATE TABLE public.members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_code text NOT NULL UNIQUE DEFAULT 'SHP-' || lpad(nextval('public.member_code_seq')::text, 4, '0'),
  full_name text NOT NULL,
  photo_url text,
  phone text,
  email text,
  home_address text,
  gender text,
  birth_month int CHECK (birth_month BETWEEN 1 AND 12),
  birth_year int,
  age_bracket text,
  anniversary_month int CHECK (anniversary_month BETWEEN 1 AND 12),
  anniversary_day int CHECK (anniversary_day BETWEEN 1 AND 31),
  marital_status text,
  department text,
  membership_year int,
  is_first_timer boolean NOT NULL DEFAULT false,
  invited_by uuid REFERENCES public.members(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.members TO authenticated;
GRANT ALL ON public.members TO service_role;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select" ON public.members FOR SELECT TO authenticated
  USING (
    public.has_full_access(auth.uid())
    OR (public.has_role(auth.uid(),'department_leader') AND department IS NOT DISTINCT FROM public.my_department(auth.uid()))
    OR user_id = auth.uid()
    OR created_by = auth.uid()
  );
CREATE POLICY "members_insert" ON public.members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "members_update" ON public.members FOR UPDATE TO authenticated
  USING (public.has_full_access(auth.uid()) OR user_id = auth.uid())
  WITH CHECK (public.has_full_access(auth.uid()) OR user_id = auth.uid());
CREATE POLICY "members_delete" ON public.members FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'senior_pastor'));

-- attendance
CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  service_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  service_type text NOT NULL DEFAULT 'Sunday Service',
  status text NOT NULL DEFAULT 'Present',
  check_in_time timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, service_date, service_type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendance_select" ON public.attendance FOR SELECT TO authenticated
  USING (
    public.has_full_access(auth.uid())
    OR EXISTS (SELECT 1 FROM public.members m WHERE m.id = member_id AND (
        m.user_id = auth.uid()
        OR (public.has_role(auth.uid(),'department_leader') AND m.department IS NOT DISTINCT FROM public.my_department(auth.uid()))
    ))
  );
CREATE POLICY "attendance_insert" ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "attendance_update" ON public.attendance FOR UPDATE TO authenticated
  USING (public.has_full_access(auth.uid())) WITH CHECK (public.has_full_access(auth.uid()));
CREATE POLICY "attendance_delete" ON public.attendance FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'senior_pastor'));

-- follow ups
CREATE TABLE public.follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  contact_method text NOT NULL,
  situation text,
  contacted_on date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.follow_ups TO authenticated;
GRANT ALL ON public.follow_ups TO service_role;
ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "follow_ups_select" ON public.follow_ups FOR SELECT TO authenticated
  USING (public.has_full_access(auth.uid()) OR public.has_role(auth.uid(),'department_leader'));
CREATE POLICY "follow_ups_insert" ON public.follow_ups FOR INSERT TO authenticated
  WITH CHECK (public.has_full_access(auth.uid()) OR public.has_role(auth.uid(),'department_leader'));
CREATE POLICY "follow_ups_update" ON public.follow_ups FOR UPDATE TO authenticated
  USING (public.has_full_access(auth.uid())) WITH CHECK (public.has_full_access(auth.uid()));
CREATE POLICY "follow_ups_delete" ON public.follow_ups FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'senior_pastor'));

-- church settings (singleton)
CREATE TABLE public.church_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  church_name text NOT NULL DEFAULT 'Hope Hall',
  latitude double precision,
  longitude double precision,
  radius_meters int NOT NULL DEFAULT 300,
  geofence_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.church_settings TO authenticated;
GRANT ALL ON public.church_settings TO service_role;
ALTER TABLE public.church_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_select" ON public.church_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings_update" ON public.church_settings FOR UPDATE TO authenticated
  USING (public.has_full_access(auth.uid())) WITH CHECK (public.has_full_access(auth.uid()));
CREATE POLICY "settings_insert" ON public.church_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_full_access(auth.uid()));

INSERT INTO public.church_settings (id, church_name, geofence_enabled) VALUES (1, 'Hope Hall', false);

-- signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
