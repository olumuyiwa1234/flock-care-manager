-- 1) Tighten cluster matching: a leader with no assigned sub-role must not match anyone
CREATE OR REPLACE FUNCTION app.in_my_cluster(_user_id uuid, _department text, _gender text, _marital text, _bracket text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN app.my_sub_role(_user_id) IS NULL THEN false
    WHEN app.has_role(_user_id, 'hod'::public.app_role) THEN
      CASE WHEN app.my_sub_role(_user_id) = 'Children'
           THEN _bracket IN ('0-12','13-17')
           ELSE _department = app.my_sub_role(_user_id) END
    WHEN app.has_role(_user_id, 'group_leader'::public.app_role) THEN
      app.fellowship_of(_gender, _marital, _bracket) IS NOT NULL
        AND app.fellowship_of(_gender, _marital, _bracket) = app.my_sub_role(_user_id)
    ELSE false END
$function$;

-- 2) Server-side geofence check that never exposes church coordinates
CREATE OR REPLACE FUNCTION public.check_geofence(_lat double precision, _lng double precision)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  s public.church_settings%ROWTYPE;
  dist double precision;
BEGIN
  SELECT * INTO s FROM public.church_settings WHERE id = 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('church_name', 'Church', 'enabled', false, 'allowed', true);
  END IF;
  IF NOT s.geofence_enabled OR s.latitude IS NULL OR s.longitude IS NULL THEN
    RETURN jsonb_build_object('church_name', s.church_name, 'enabled', false, 'allowed', true);
  END IF;
  dist := 6371000 * acos(least(1,
    cos(radians(_lat)) * cos(radians(s.latitude)) *
    cos(radians(s.longitude) - radians(_lng)) +
    sin(radians(_lat)) * sin(radians(s.latitude))
  ));
  RETURN jsonb_build_object(
    'church_name', s.church_name,
    'enabled', true,
    'allowed', dist <= s.radius_meters
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.check_geofence(double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_geofence(double precision, double precision) TO authenticated;

-- 3) Restrict church settings reads to full-access staff
DROP POLICY settings_select ON public.church_settings;
CREATE POLICY settings_select ON public.church_settings
  FOR SELECT TO authenticated
  USING (app.has_full_access(auth.uid()));