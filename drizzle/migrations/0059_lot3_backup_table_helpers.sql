CREATE OR REPLACE FUNCTION public.list_public_tables()
RETURNS TABLE(table_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT t.table_name::text FROM information_schema.tables t
  WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
  ORDER BY t.table_name;
$$;
REVOKE ALL ON FUNCTION public.list_public_tables() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_public_tables() TO service_role;

CREATE OR REPLACE FUNCTION public.list_public_fk_dependencies()
RETURNS TABLE(table_name text, depends_on text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT c.conrelid::regclass::text, c.confrelid::regclass::text
  FROM pg_constraint c
  JOIN pg_namespace n ON n.oid = c.connamespace
  WHERE c.contype = 'f' AND n.nspname = 'public'
    AND c.confrelid::regclass::text NOT LIKE '%.%';
$$;
REVOKE ALL ON FUNCTION public.list_public_fk_dependencies() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_public_fk_dependencies() TO service_role;