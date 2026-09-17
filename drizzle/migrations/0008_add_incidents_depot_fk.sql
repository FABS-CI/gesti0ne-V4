ALTER TABLE public.incidents
  ADD CONSTRAINT incidents_depot_id_fkey
  FOREIGN KEY (depot_id) REFERENCES public.depots(depot_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_incidents_depot_id ON public.incidents(depot_id);