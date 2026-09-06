CREATE OR REPLACE FUNCTION app.csv_list(_v text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(array(
    SELECT btrim(x) FROM unnest(string_to_array(coalesce(_v,''), ',')) AS x
    WHERE btrim(x) <> ''
  ), ARRAY[]::text[])
$$;

CREATE OR REPLACE FUNCTION app.in_my_cluster(_user_id uuid, _department text, _gender text, _marital text, _bracket text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN app.my_sub_role(_user_id) IS NULL THEN false
    WHEN app.has_role(_user_id, 'hod'::public.app_role) THEN
      CASE WHEN 'Children' = ANY(app.csv_list(app.my_sub_role(_user_id)))
           THEN _bracket IN ('0-12','13-17')
           ELSE app.csv_list(_department) && app.csv_list(app.my_sub_role(_user_id)) END
    WHEN app.has_role(_user_id, 'group_leader'::public.app_role) THEN
      app.fellowship_of(_gender, _marital, _bracket) IS NOT NULL
        AND app.fellowship_of(_gender, _marital, _bracket) = ANY(app.csv_list(app.my_sub_role(_user_id)))
    ELSE false END
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  valid_roles text[] := ARRAY['pastorate','hod','group_leader','member','it_infrastructure','follow_up'];
  requested text[];
  sub text := NEW.raw_user_meta_data->>'sub_role';
  r text;
  status text;
BEGIN
  IF (NEW.raw_user_meta_data ? 'roles') AND jsonb_typeof(NEW.raw_user_meta_data->'roles') = 'array' THEN
    SELECT coalesce(array_agg(DISTINCT v), ARRAY[]::text[]) INTO requested
    FROM jsonb_array_elements_text(NEW.raw_user_meta_data->'roles') AS t(v)
    WHERE v = ANY(valid_roles);
  END IF;

  IF requested IS NULL OR array_length(requested, 1) IS NULL THEN
    requested := ARRAY[coalesce(NEW.raw_user_meta_data->>'role','member')];
    IF NOT (requested[1] = ANY(valid_roles)) THEN
      requested := ARRAY['member'];
    END IF;
  END IF;

  IF 'pastorate' = ANY(requested) AND 'Pastor' = ANY(app.csv_list(sub)) THEN
    IF EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.id
      WHERE ur.role = 'pastorate' AND 'Pastor' = ANY(app.csv_list(p.sub_role))
    ) THEN
      RAISE EXCEPTION 'A Pastor account already exists. Only one Pastor can be registered.';
    END IF;
  END IF;

  IF (SELECT bool_and(x = 'member') FROM unnest(requested) AS x)
     OR ('pastorate' = ANY(requested) AND 'Pastor' = ANY(app.csv_list(sub))) THEN
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

  FOREACH r IN ARRAY requested LOOP
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, r::public.app_role)
    ON CONFLICT DO NOTHING;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM public.members m WHERE m.user_id = NEW.id) THEN
    INSERT INTO public.members (full_name, email, phone, department, photo_url, user_id, created_by)
    VALUES (
      coalesce(nullif(NEW.raw_user_meta_data->>'full_name',''), NEW.email, 'New member'),
      NEW.email,
      NEW.raw_user_meta_data->>'phone',
      NEW.raw_user_meta_data->>'department',
      coalesce(NEW.raw_user_meta_data->>'photo_url', NEW.raw_user_meta_data->>'avatar_url'),
      NEW.id,
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO service_role;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA app FROM anon, public;