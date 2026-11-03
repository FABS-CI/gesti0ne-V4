CREATE OR REPLACE FUNCTION public._ecriture_garde_exercice_clos()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ex uuid; v_statut text;
BEGIN
  IF TG_TABLE_NAME = 'ecriture_lignes' THEN
    SELECT exercice_id INTO v_ex FROM public.ecritures_comptables
     WHERE ecriture_id = COALESCE(NEW.ecriture_id, OLD.ecriture_id);
  ELSE
    v_ex := CASE WHEN TG_OP = 'DELETE' THEN OLD.exercice_id ELSE NEW.exercice_id END;
    IF TG_OP = 'UPDATE' AND OLD.exercice_id IS DISTINCT FROM NEW.exercice_id THEN
      SELECT statut INTO v_statut FROM public.exercices_comptables WHERE exercice_id = OLD.exercice_id;
      IF lower(coalesce(v_statut,'')) LIKE 'clo%' THEN
        RAISE EXCEPTION 'Exercice clôturé : écriture non modifiable' USING ERRCODE='42501';
      END IF;
    END IF;
  END IF;
  SELECT statut INTO v_statut FROM public.exercices_comptables WHERE exercice_id = v_ex;
  IF lower(coalesce(v_statut,'')) LIKE 'clo%' THEN
    RAISE EXCEPTION 'Exercice clôturé : aucune écriture ne peut y être ajoutée, modifiée ou supprimée' USING ERRCODE='42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_garde_exercice_clos ON public.ecritures_comptables;
CREATE TRIGGER trg_garde_exercice_clos BEFORE INSERT OR UPDATE OR DELETE ON public.ecritures_comptables
FOR EACH ROW EXECUTE FUNCTION public._ecriture_garde_exercice_clos();
DROP TRIGGER IF EXISTS trg_garde_exercice_clos ON public.ecriture_lignes;
CREATE TRIGGER trg_garde_exercice_clos BEFORE INSERT OR UPDATE OR DELETE ON public.ecriture_lignes
FOR EACH ROW EXECUTE FUNCTION public._ecriture_garde_exercice_clos();

CREATE OR REPLACE FUNCTION public.creer_ecriture_manuelle(
  _date date, _journal text, _reference text, _libelle text, _lignes jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_d numeric := 0; v_c numeric := 0; v_n int := 0; l jsonb; d numeric; c numeric;
BEGIN
  IF NOT public.rbac3_can('comptabilite.modifier') THEN
    RAISE EXCEPTION 'Permission refusée : comptabilite.modifier' USING ERRCODE='42501';
  END IF;
  IF coalesce(trim(_libelle),'') = '' THEN RAISE EXCEPTION 'Libellé requis'; END IF;
  FOR l IN SELECT * FROM jsonb_array_elements(_lignes) LOOP
    d := round(coalesce((l->>'debit')::numeric,0),2); c := round(coalesce((l->>'credit')::numeric,0),2);
    IF d < 0 OR c < 0 OR (d > 0 AND c > 0) THEN
      RAISE EXCEPTION 'Une ligne doit avoir soit un débit, soit un crédit positif';
    END IF;
    IF coalesce(trim(l->>'compte'),'') = '' OR (d = 0 AND c = 0) THEN CONTINUE; END IF;
    v_d := v_d + d; v_c := v_c + c; v_n := v_n + 1;
  END LOOP;
  IF v_n < 2 THEN RAISE EXCEPTION 'Au moins 2 lignes valides sont requises'; END IF;
  IF v_d <> v_c OR v_d = 0 THEN RAISE EXCEPTION 'L''écriture doit être équilibrée (débit = crédit)'; END IF;

  INSERT INTO public.ecritures_comptables(date_ecriture, journal, reference, libelle, montant_total, source_type)
  VALUES (_date, _journal, nullif(trim(_reference),''), trim(_libelle), v_d, 'manuel')
  RETURNING ecriture_id INTO v_id;
  IF (SELECT reference FROM public.ecritures_comptables WHERE ecriture_id = v_id) IS NULL THEN
    UPDATE public.ecritures_comptables SET reference = _journal || '-' || left(replace(v_id::text,'-',''),8)
     WHERE ecriture_id = v_id;
  END IF;

  INSERT INTO public.ecriture_lignes(ecriture_id, compte, compte_libelle, debit, credit)
  SELECT v_id, trim(x->>'compte'), coalesce(nullif(trim(x->>'compte_libelle'),''), trim(x->>'compte')),
         round(coalesce((x->>'debit')::numeric,0),2), round(coalesce((x->>'credit')::numeric,0),2)
  FROM jsonb_array_elements(_lignes) x
  WHERE coalesce(trim(x->>'compte'),'') <> ''
    AND (coalesce((x->>'debit')::numeric,0) > 0 OR coalesce((x->>'credit')::numeric,0) > 0);
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.creer_ecriture_manuelle(date,text,text,text,jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.creer_ecriture_manuelle(date,text,text,text,jsonb) TO authenticated;