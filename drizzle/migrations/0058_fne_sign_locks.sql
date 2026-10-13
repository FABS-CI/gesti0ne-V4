-- Lot 2.2 : verrou d'idempotence des signatures DGI (un seul appel DGI par facture).
CREATE TABLE IF NOT EXISTS public.fne_sign_locks (
  doc_key text PRIMARY KEY,
  facture_id uuid NULL,
  fne_id uuid NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.fne_sign_locks TO service_role;
ALTER TABLE public.fne_sign_locks ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.fne_sign_locks IS 'Verrou serveur (service_role uniquement) : une ligne par document en cours de signature ou signé auprès de la DGI.';
CREATE INDEX IF NOT EXISTS fne_logs_action_created_idx ON public.fne_logs (action, created_at DESC);