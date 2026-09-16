ALTER TABLE public.ecritures_comptables
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS source_id uuid,
  ADD COLUMN IF NOT EXISTS montant_total numeric NOT NULL DEFAULT 0;

UPDATE public.ecritures_comptables
   SET montant_total = COALESCE(montant, 0)
 WHERE montant_total = 0 AND montant IS NOT NULL;

CREATE OR REPLACE FUNCTION public._ecriture_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- montant <-> montant_total : source unique
  IF NEW.montant_total IS NULL OR NEW.montant_total = 0 THEN
    NEW.montant_total := COALESCE(NEW.montant, 0);
  END IF;
  IF NEW.montant IS NULL OR NEW.montant = 0 THEN
    NEW.montant := COALESCE(NEW.montant_total, 0);
  END IF;
  IF NEW.exercice_id IS NULL THEN
    BEGIN
      NEW.exercice_id := public._resolve_exercice_id(NEW.date_ecriture);
    EXCEPTION WHEN OTHERS THEN
      NEW.exercice_id := NULL;
    END;
  END IF;
  IF NEW.statut IS NULL THEN
    NEW.statut := 'valide';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ecriture_sync ON public.ecritures_comptables;
CREATE TRIGGER trg_ecriture_sync
BEFORE INSERT OR UPDATE ON public.ecritures_comptables
FOR EACH ROW EXECUTE FUNCTION public._ecriture_sync();

CREATE OR REPLACE FUNCTION public._ecriture_ligne_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.compte IS NULL THEN NEW.compte := NEW.numero_compte; END IF;
  IF NEW.numero_compte IS NULL THEN NEW.numero_compte := NEW.compte; END IF;
  IF NEW.compte_libelle IS NULL THEN NEW.compte_libelle := NEW.libelle; END IF;
  IF NEW.libelle IS NULL THEN NEW.libelle := NEW.compte_libelle; END IF;
  NEW.debit := COALESCE(NEW.debit, 0);
  NEW.credit := COALESCE(NEW.credit, 0);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ecriture_ligne_sync ON public.ecriture_lignes;
CREATE TRIGGER trg_ecriture_ligne_sync
BEFORE INSERT OR UPDATE ON public.ecriture_lignes
FOR EACH ROW EXECUTE FUNCTION public._ecriture_ligne_sync();

CREATE INDEX IF NOT EXISTS idx_ecritures_source ON public.ecritures_comptables (source_type, source_id);

GRANT SELECT, INSERT, UPDATE ON public.ecritures_comptables TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.ecriture_lignes TO authenticated;
GRANT ALL ON public.ecritures_comptables TO service_role;
GRANT ALL ON public.ecriture_lignes TO service_role;