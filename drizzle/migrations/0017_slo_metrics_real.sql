-- Indicateurs SLO réels (remplacent les valeurs factices)
CREATE OR REPLACE FUNCTION public.get_slo_metrics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_errors bigint := 0;
  v_alerts bigint := 0;
  v_size text := '—';
  v_conn int := 0;
  v_slow jsonb := '[]'::jsonb;
BEGIN
  PERFORM public.assert_permission('audit.voir');

  SELECT count(*) INTO v_errors
  FROM public.perf_query_log
  WHERE created_at > now() - interval '24 hours'
    AND coalesce(status, '') <> 'ok';

  SELECT v_errors + count(*) INTO v_errors
  FROM public.audit_events
  WHERE occurred_at > now() - interval '24 hours'
    AND (coalesce(status, '') ILIKE '%error%' OR coalesce(status, '') ILIKE '%echec%' OR error_message IS NOT NULL);

  SELECT count(*) INTO v_alerts
  FROM public.incident_alerts
  WHERE resolved IS NOT TRUE;

  SELECT pg_size_pretty(pg_database_size(current_database())) INTO v_size;

  SELECT count(*) INTO v_conn
  FROM pg_stat_activity
  WHERE datname = current_database();

  SELECT coalesce(jsonb_agg(x ORDER BY x->>'total_ms' DESC), '[]'::jsonb) INTO v_slow
  FROM (
    SELECT jsonb_build_object(
             'query', coalesce(q.query_key, q.route, '—'),
             'calls', count(*),
             'mean_ms', round(avg(q.duration_ms))::int,
             'total_ms', round(sum(q.duration_ms))::int
           ) AS x
    FROM public.perf_query_log q
    WHERE q.created_at > now() - interval '7 days'
      AND q.duration_ms IS NOT NULL
    GROUP BY coalesce(q.query_key, q.route, '—')
    ORDER BY sum(q.duration_ms) DESC
    LIMIT 10
  ) s;

  RETURN jsonb_build_object(
    'errors_24h', v_errors,
    'alerts_open', v_alerts,
    'db_size', v_size,
    'active_connections', v_conn,
    'slow_queries', v_slow,
    'generated_at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF')
  );
END; $$;

REVOKE EXECUTE ON FUNCTION public.get_slo_metrics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_slo_metrics() TO authenticated;