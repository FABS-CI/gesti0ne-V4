CREATE OR REPLACE FUNCTION public.generate_ecriture_bulletin(_bulletin_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE b RECORD; v_piece text; v_id uuid; v_social numeric; v_fiscal numeric; v_autres numeric; v_arr numeric; v_date date; v_lib text;
BEGIN
  SELECT * INTO b FROM public.bulletins_paie WHERE bulletin_id = _bulletin_id;
  IF NOT FOUND OR b.statut <> 'valide' OR COALESCE(b.salaire_brut,0) <= 0 THEN RETURN NULL; END IF;
  v_piece := 'BUL:' || b.bulletin_id::text;
  SELECT ecriture_id INTO v_id FROM public.ecritures_comptables WHERE piece_ref = v_piece;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  SELECT COALESCE(sum(retenue),0) INTO v_social FROM public.bulletin_lignes
   WHERE bulletin_id = b.bulletin_id AND bloc <> 'patronal' AND retenue > 0
     AND libelle ~* '(C\.R|CMU|retraite|CNPS)';
  v_autres := COALESCE(b.total_autres_retenues,0);
  v_fiscal := COALESCE(b.retenues,0) - v_social - v_autres;
  v_arr := COALESCE(b.arrondi,0);
  v_date := COALESCE(b.date_paiement, b.date_fin, b.date_bulletin);
  v_lib := 'Paie ' || COALESCE(b.periode,'') || ' - ' || COALESCE(b.employe_nom,'');

  INSERT INTO public.ecritures_comptables (reference, journal_id, journal, date_ecriture, libelle, montant, statut, piece_ref, exercice_id)
  VALUES (b.reference, public._journal_id('OD'), 'OD', v_date, v_lib,
          b.salaire_brut + COALESCE(b.cotisations,0) + GREATEST(v_arr,0), 'valide', v_piece, b.exercice_id)
  RETURNING ecriture_id INTO v_id;

  INSERT INTO public.ecriture_lignes (ecriture_id, numero_compte, compte, compte_libelle, libelle, debit, credit)
  SELECT v_id, x.c, x.c, x.cl, x.l, x.d, x.k FROM (VALUES
    ('661','Rémunérations du personnel','Salaire brut '||b.reference, b.salaire_brut, 0::numeric),
    ('664','Charges sociales','Charges patronales '||b.reference, COALESCE(b.cotisations,0), 0),
    ('658','Charges diverses','Arrondi de paie '||b.reference, GREATEST(v_arr,0), 0),
    ('422','Personnel, rémunérations dues','Net à payer '||COALESCE(b.employe_nom,''), 0, COALESCE(b.net_a_payer,0)),
    ('447','État, impôts retenus à la source','ITS '||b.reference, 0, v_fiscal),
    ('431','Sécurité sociale (CNPS, CMU)','Cotisations salariales et patronales '||b.reference, 0, v_social + COALESCE(b.cotisations,0)),
    ('421','Personnel, avances et acomptes','Autres retenues '||b.reference, 0, v_autres),
    ('758','Produits divers','Arrondi de paie '||b.reference, 0, GREATEST(-v_arr,0))
  ) AS x(c,cl,l,d,k) WHERE x.d <> 0 OR x.k <> 0;
  RETURN v_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.generate_ecriture_bulletin(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._trg_bulletin_ecriture()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.statut = 'valide' AND (TG_OP = 'INSERT' OR OLD.statut IS DISTINCT FROM 'valide') THEN
    PERFORM public.generate_ecriture_bulletin(NEW.bulletin_id);
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public._trg_bulletin_ecriture() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_bulletin_ecriture ON public.bulletins_paie;
CREATE TRIGGER trg_bulletin_ecriture AFTER INSERT OR UPDATE OF statut ON public.bulletins_paie
FOR EACH ROW EXECUTE FUNCTION public._trg_bulletin_ecriture();