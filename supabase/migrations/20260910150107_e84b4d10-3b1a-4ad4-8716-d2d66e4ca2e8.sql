CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  valid_roles text[] := ARRAY['pastorate','hod','group_leader','member','it_infrastructure','follow_up'];
  requested text[];
  md jsonb := coalesce(NEW.raw_user_meta_data, '{}'::jsonb);
  sub text := md->>'sub_role';
  r text;
  status text;
BEGIN
  -- Work out which roles were requested at sign-up, keeping only valid ones.
  IF (md ? 'roles') AND jsonb_typeof(md->'roles') = 'array' THEN
    SELECT coalesce(array_agg(DISTINCT v), ARRAY[]::text[]) INTO requested
    FROM jsonb_array_elements_text(md->'roles') AS t(v)
    WHERE v = ANY(valid_roles);
  END IF;

  IF requested IS NULL OR array_length(requested, 1) IS NULL THEN
    requested := ARRAY[coalesce(md->>'role','member')];
    IF NOT (requested[1] = ANY(valid_roles)) THEN
      requested := ARRAY['member'];
    END IF;
  END IF;

  -- Only one Pastor may exist in the church.
  IF 'pastorate' = ANY(requested) AND 'Pastor' = ANY(app.csv_list(sub)) THEN
    IF EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.id
      WHERE ur.role = 'pastorate' AND 'Pastor' = ANY(app.csv_list(p.sub_role))
    ) THEN
      RAISE EXCEPTION 'A Pastor account already exists. Only one Pastor can be registered.';
    END IF;
  END IF;

  -- Plain members and the Pastor are approved instantly; leaders wait for approval.
  IF (SELECT bool_and(x = 'member') FROM unnest(requested) AS x)
     OR ('pastorate' = ANY(requested) AND 'Pastor' = ANY(app.csv_list(sub))) THEN
    status := 'approved';
  ELSE
    status := 'pending';
  END IF;

  -- Create the login profile record.
  INSERT INTO public.profiles (id, full_name, phone, department, sub_role, approval_status, approved_at)
  VALUES (NEW.id,
          coalesce(md->>'full_name',''),
          md->>'phone',
          md->>'department',
          sub,
          status,
          CASE WHEN status = 'approved' THEN now() ELSE NULL END);

  -- Grant the requested roles.
  FOREACH r IN ARRAY requested LOOP
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, r::public.app_role)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Create the member record with EVERY detail supplied on the registration form.
  IF NOT EXISTS (SELECT 1 FROM public.members m WHERE m.user_id = NEW.id) THEN
    INSERT INTO public.members (
      full_name, email, phone, home_address, gender,
      birth_month, birth_day, age_bracket,
      anniversary_month, anniversary_day, marital_status,
      department, membership_year, status, natural_group,
      photo_url, user_id, created_by
    )
    VALUES (
      coalesce(nullif(md->>'full_name',''), NEW.email, 'New member'),
      NEW.email,
      nullif(md->>'phone',''),
      nullif(md->>'home_address',''),
      nullif(md->>'gender',''),
      nullif(md->>'birth_month','')::int,
      nullif(md->>'birth_day','')::int,
      nullif(md->>'age_bracket',''),
      nullif(md->>'anniversary_month','')::int,
      nullif(md->>'anniversary_day','')::int,
      nullif(md->>'marital_status',''),
      nullif(md->>'department',''),
      nullif(md->>'membership_year','')::int,
      CASE WHEN md->>'member_status' = 'Worker' THEN 'Worker' ELSE 'Member' END,
      nullif(md->>'natural_group',''),
      coalesce(nullif(md->>'photo_url',''), nullif(md->>'avatar_url','')),
      NEW.id,
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$function$;