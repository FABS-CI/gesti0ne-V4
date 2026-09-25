CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

ALTER TABLE public.backups
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS fichier_disponible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification jsonb,
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.backup_cron_config (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  job_name text NOT NULL DEFAULT 'erp-global-backup-3h',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.backup_cron_config TO service_role;
ALTER TABLE public.backup_cron_config ENABLE ROW LEVEL SECURITY;
INSERT INTO public.backup_cron_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_next_backup_run()
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, cron
AS $$
DECLARE
  v_active boolean;
  v_now timestamptz := now();
  v_hour int;
BEGIN
  SELECT j.active INTO v_active FROM cron.job j WHERE j.jobname = 'erp-global-backup-3h' LIMIT 1;
  IF v_active IS DISTINCT FROM true THEN
    RETURN NULL;
  END IF;
  v_hour := extract(hour FROM (v_now AT TIME ZONE 'UTC'))::int;
  RETURN date_trunc('hour', v_now) + make_interval(hours => 3 - (v_hour % 3));
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_next_backup_run() TO authenticated;