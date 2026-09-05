CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  IF final_role = 'pastorate' AND sub = 'Pastor' THEN
    IF EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.user_roles r ON r.user_id = p.id
      WHERE r.role = 'pastorate' AND p.sub_role = 'Pastor'
    ) THEN
      RAISE EXCEPTION 'A Pastor account already exists. Only one Pastor can be registered.';
    END IF;
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

INSERT INTO public.members (full_name, email, phone, department, photo_url, user_id, created_by)
SELECT coalesce(nullif(p.full_name,''), u.email, 'New member'),
       u.email,
       p.phone,
       p.department,
       u.raw_user_meta_data->>'avatar_url',
       p.id,
       p.id
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE NOT EXISTS (SELECT 1 FROM public.members m WHERE m.user_id = p.id);