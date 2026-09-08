CREATE OR REPLACE FUNCTION app.is_approved_pastor(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles r
    JOIN public.profiles p ON p.id = r.user_id
    WHERE r.user_id = _user_id
      AND r.role = 'pastorate'::public.app_role
      AND (app.csv_list(p.sub_role) && ARRAY['Pastor','Parish Coordinator'])
      AND p.approval_status = 'approved'
  );
$function$;

DROP POLICY IF EXISTS suggestions_select ON public.suggestions;
CREATE POLICY suggestions_select ON public.suggestions
FOR SELECT TO authenticated
USING ((user_id = auth.uid()) OR app.is_approved_pastor(auth.uid()));