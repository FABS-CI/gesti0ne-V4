-- Recherche d'audit : le libellé français de l'action doit être cherché
-- côté serveur, comme dans l'interface, pour que le compteur et la liste concordent.

CREATE OR REPLACE FUNCTION public.audit_action_label(p_action text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE p_action
    WHEN 'INSERT' THEN 'Création'
    WHEN 'UPDATE' THEN 'Modification'
    WHEN 'DELETE' THEN 'Suppression'
    WHEN 'create_depot' THEN 'Création dépôt'
    WHEN 'update_depot' THEN 'Modification dépôt'
    WHEN 'delete_depot' THEN 'Suppression dépôt'
    WHEN 'ajuster_stock_depot' THEN 'Ajustement stock'
    WHEN 'create_approvisionnement' THEN 'Approvisionnement'
    WHEN 'create_inventaire_physique' THEN 'Création inventaire'
    WHEN 'valider_inventaire_physique' THEN 'Validation inventaire'
    WHEN 'regulariser_inventaire' THEN 'Régularisation inventaire'
    WHEN 'create_specimen' THEN 'Création spécimen'
    WHEN 'cancel_specimen' THEN 'Annulation spécimen'
    WHEN 'create_incident_stock' THEN 'Création incident'
    WHEN 'cancel_incident_stock' THEN 'Annulation incident'
    ELSE COALESCE(p_action, '')
  END;
$function$;

GRANT EXECUTE ON FUNCTION public.audit_action_label(text) TO authenticated, service_role;

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
        a.record_id ILIKE '%' || p_search || '%' OR
        a.record_ref ILIKE '%' || p_search || '%' OR
        a.url ILIKE '%' || p_search || '%' OR
        public.audit_action_label(a.action) ILIKE '%' || p_search || '%'
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

CREATE OR REPLACE FUNCTION public.audit_events_list(p_module text DEFAULT NULL::text, p_period_days integer DEFAULT NULL::integer, p_user_email text DEFAULT NULL::text, p_action text DEFAULT NULL::text, p_search text DEFAULT NULL::text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 50)
 RETURNS TABLE(id uuid, user_email text, user_id uuid, action text, module text, table_name text, record_id text, record_ref text, occurred_at timestamp with time zone, old_values jsonb, new_values jsonb, changes jsonb, ip_address text, user_agent text, url text, http_method text, status text, status_code integer, duration_ms integer, error_message text, criticite text, session_id text, correlation_id uuid, city text, country text, country_code text, browser text, browser_version text, os text, device text, screen_resolution text, timezone text, total_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        a.record_id ILIKE '%' || p_search || '%' OR
        a.record_ref ILIKE '%' || p_search || '%' OR
        a.url ILIKE '%' || p_search || '%' OR
        public.audit_action_label(a.action) ILIKE '%' || p_search || '%'
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
$function$;