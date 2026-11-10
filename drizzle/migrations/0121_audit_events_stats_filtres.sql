CREATE OR REPLACE FUNCTION public.audit_events_stats(p_module text DEFAULT NULL::text, p_period_days integer DEFAULT NULL::integer, p_user_email text DEFAULT NULL::text, p_action text DEFAULT NULL::text, p_search text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r jsonb;
BEGIN
  PERFORM public.assert_permission('audit.voir');
  WITH filtered AS (
    SELECT a.user_email, a.occurred_at
    FROM public.audit_events a
    WHERE (p_module IS NULL OR a.table_name = p_module OR a.module = p_module)
      AND (p_period_days IS NULL OR a.occurred_at >= now() - make_interval(days => p_period_days))
      AND (p_user_email IS NULL OR a.user_email = p_user_email)
      AND (p_action IS NULL OR a.action = p_action)
      AND (
        p_search IS NULL OR p_search = '' OR
        a.user_email ILIKE '%' || p_search || '%' OR
        a.action ILIKE '%' || p_search || '%' OR
        a.table_name ILIKE '%' || p_search || '%' OR
        a.record_ref ILIKE '%' || p_search || '%' OR
        a.url ILIKE '%' || p_search || '%'
      )
  )
  SELECT jsonb_build_object(
    'total_events', count(*),
    'unique_users', count(DISTINCT user_email),
    'today_events', count(*) FILTER (WHERE occurred_at >= date_trunc('day', now() AT TIME ZONE 'Africa/Abidjan') AT TIME ZONE 'Africa/Abidjan'),
    'connected_15min', count(DISTINCT user_email) FILTER (WHERE occurred_at >= now() - interval '15 minutes'),
    'total', count(*)
  ) INTO r FROM filtered;
  RETURN r;
END; $function$;