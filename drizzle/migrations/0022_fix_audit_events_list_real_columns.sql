DROP FUNCTION IF EXISTS public.audit_events_list(text, integer, text, text, text, integer, integer);

CREATE FUNCTION public.audit_events_list(
  p_module text DEFAULT NULL,
  p_period_days integer DEFAULT NULL,
  p_user_email text DEFAULT NULL,
  p_action text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50
)
RETURNS TABLE(
  id uuid, user_email text, user_id uuid, action text, module text, table_name text,
  record_id text, record_ref text, occurred_at timestamptz,
  old_values jsonb, new_values jsonb, changes jsonb,
  ip_address text, user_agent text, url text, http_method text,
  status text, status_code integer, duration_ms integer, error_message text,
  criticite text, session_id text, correlation_id uuid,
  city text, country text, country_code text,
  browser text, browser_version text, os text, device text,
  screen_resolution text, timezone text,
  total_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH filtered AS (
    SELECT a.*
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
  SELECT f.id, f.user_email, f.user_id, f.action, f.module, f.table_name,
         f.record_id, f.record_ref, f.occurred_at,
         f.old_values, f.new_values, f.changes,
         f.ip_address, f.user_agent, f.url, f.http_method,
         f.status, f.status_code, f.duration_ms, f.error_message,
         f.criticite, f.session_id, f.correlation_id,
         f.city, f.country, f.country_code,
         f.browser, f.browser_version, f.os, f.device,
         f.screen_resolution, f.timezone,
         (SELECT count(*) FROM filtered) AS total_count
  FROM filtered f
  ORDER BY f.occurred_at DESC
  LIMIT GREATEST(COALESCE(p_page_size, 50), 1)
  OFFSET GREATEST((COALESCE(p_page, 1) - 1) * COALESCE(p_page_size, 50), 0);
$$;

GRANT EXECUTE ON FUNCTION public.audit_events_list(text, integer, text, text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.audit_events_list(text, integer, text, text, text, integer, integer) TO service_role;