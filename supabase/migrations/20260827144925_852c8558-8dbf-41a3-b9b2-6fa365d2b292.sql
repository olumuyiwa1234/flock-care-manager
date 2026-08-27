
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_full_access(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_department(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_full_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_department(uuid) TO authenticated;
