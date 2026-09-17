CREATE OR REPLACE FUNCTION public.has_role_compat(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role_compat(_user_id, _role::text);
$$;

REVOKE ALL ON FUNCTION public.has_role_compat(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role_compat(uuid, app_role) TO authenticated, service_role;