CREATE SEQUENCE IF NOT EXISTS public.employe_ref_seq;

CREATE OR REPLACE FUNCTION public._employe_set_matricule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NULLIF(NEW.matricule, '') IS NULL THEN
    NEW.matricule := 'EMP-' || lpad(nextval('public.employe_ref_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_employes_set_matricule ON public.employes;
CREATE TRIGGER trg_employes_set_matricule
  BEFORE INSERT ON public.employes
  FOR EACH ROW EXECUTE FUNCTION public._employe_set_matricule();