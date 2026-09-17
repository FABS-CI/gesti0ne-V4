DROP FUNCTION IF EXISTS public.has_role_compat(uuid, app_role);

CREATE OR REPLACE FUNCTION public.export_config_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role_compat(auth.uid(), 'super_admin'::text) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT jsonb_build_object(
    'generated_at', now(),
    'policies', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'schema', schemaname,
        'table', tablename,
        'name', policyname,
        'permissive', permissive,
        'roles', roles,
        'command', cmd,
        'using', qual,
        'with_check', with_check
      ) ORDER BY tablename, policyname)
      FROM pg_policies WHERE schemaname = 'public'
    ), '[]'::jsonb),
    'functions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name', p.proname,
        'security_definer', p.prosecdef,
        'definition', pg_get_functiondef(p.oid)
      ) ORDER BY p.proname)
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
    ), '[]'::jsonb),
    'triggers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'table', c.relname,
        'name', t.tgname,
        'definition', pg_get_triggerdef(t.oid)
      ) ORDER BY c.relname, t.tgname)
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND NOT t.tgisinternal
    ), '[]'::jsonb),
    'extensions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', extname, 'version', extversion) ORDER BY extname)
      FROM pg_extension
    ), '[]'::jsonb),
    'tables', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', c.relname, 'rls_enabled', c.relrowsecurity) ORDER BY c.relname)
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
    ), '[]'::jsonb)
  ) INTO _result;

  RETURN _result;
END;
$$;

REVOKE ALL ON FUNCTION public.export_config_snapshot() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.export_config_snapshot() TO authenticated, service_role;