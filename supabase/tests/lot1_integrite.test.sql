-- Lot 1 — tests d'intégrité (à lancer avec un rôle autorisé, tout est annulé en fin de script)
-- psql -v ON_ERROR_STOP=1 -f supabase/tests/lot1_integrite.test.sql
BEGIN;

-- 1.1 Un paiement non validé ne compte pas dans l'encaissé
DO $$
DECLARE v_f uuid; v_p uuid; v_avant numeric;
BEGIN
  SELECT facture_id INTO v_f FROM public.factures WHERE statut IN ('impayee','partielle') LIMIT 1;
  IF v_f IS NULL THEN RAISE NOTICE 'aucune facture ouverte, test ignoré'; RETURN; END IF;
  v_avant := public.facture_encaisse(v_f);
  INSERT INTO public.paiements(paiement_id, montant, statut, date_paiement)
  VALUES (gen_random_uuid(), 1, 'en_attente_validation', current_date) RETURNING paiement_id INTO v_p;
  INSERT INTO public.payment_allocations(paiement_id, facture_id, montant) VALUES (v_p, v_f, 1);
  PERFORM public.recalc_facture_from_payment_allocations(v_f);
  IF public.facture_encaisse(v_f) <> v_avant THEN RAISE EXCEPTION 'paiement en attente compté'; END IF;
  IF (SELECT COALESCE(montant_paye,0) FROM public.factures WHERE facture_id=v_f) <> v_avant THEN
    RAISE EXCEPTION 'montant_paye modifié par un paiement en attente';
  END IF;
  UPDATE public.paiements SET statut='valide' WHERE paiement_id=v_p;
  PERFORM public.recalc_facture_from_payment_allocations(v_f);
  IF public.facture_encaisse(v_f) <> v_avant + 1 THEN RAISE EXCEPTION 'paiement validé non compté'; END IF;
  RAISE NOTICE 'OK 1.1';
END $$;

-- 1.2 Double annulation d'un retour refusée
DO $$
DECLARE v_r uuid;
BEGIN
  SELECT retour_id INTO v_r FROM public.retours WHERE statut='annule' LIMIT 1;
  IF v_r IS NULL THEN RAISE NOTICE 'aucun retour annulé, test ignoré'; RETURN; END IF;
  BEGIN
    PERFORM public.annuler_retour(v_r);
    RAISE EXCEPTION 'double annulation acceptée';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%déjà annulé%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'OK 1.2';
END $$;

ROLLBACK;
