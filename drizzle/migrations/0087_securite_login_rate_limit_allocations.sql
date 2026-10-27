CREATE TABLE IF NOT EXISTS public.login_attempts (
  id bigserial PRIMARY KEY,
  email text NOT NULL,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_attempts_email_idx ON public.login_attempts (email, created_at DESC);
CREATE INDEX IF NOT EXISTS login_attempts_ip_idx ON public.login_attempts (ip, created_at DESC);
REVOKE ALL ON public.login_attempts FROM anon, authenticated, public;
GRANT ALL ON public.login_attempts TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.login_attempts_id_seq TO service_role;
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.login_attempts IS 'Échecs de connexion (limite 5/e-mail et 20/IP sur 15 min). Accès serveur uniquement, aucune policy client.';

DROP POLICY IF EXISTS payment_allocations_read ON public.payment_allocations;
CREATE POLICY payment_allocations_read ON public.payment_allocations FOR SELECT TO authenticated
  USING (public.is_finance(auth.uid()) OR public.has_permission(auth.uid(), 'paiements.voir'));
DROP POLICY IF EXISTS pla_read ON public.payment_line_allocations;
CREATE POLICY pla_read ON public.payment_line_allocations FOR SELECT TO authenticated
  USING (public.is_finance(auth.uid()) OR public.has_permission(auth.uid(), 'paiements.voir'));
DROP POLICY IF EXISTS plaa_read ON public.payment_line_allocation_audit;
CREATE POLICY plaa_read ON public.payment_line_allocation_audit FOR SELECT TO authenticated
  USING (public.is_finance(auth.uid()) OR public.has_permission(auth.uid(), 'paiements.voir'));