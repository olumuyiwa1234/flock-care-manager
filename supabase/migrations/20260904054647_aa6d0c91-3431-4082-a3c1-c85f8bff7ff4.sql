CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  RETURN NEW;
END;
$function$;

UPDATE public.profiles p
SET approval_status = 'approved', approved_at = coalesce(p.approved_at, now())
FROM public.user_roles r
WHERE r.user_id = p.id AND r.role = 'pastorate' AND p.sub_role = 'Pastor' AND p.approval_status <> 'approved';