-- Solde client : une seule formule (migration 0091). Tout est annulé en fin de script.
-- psql -v ON_ERROR_STOP=1 -f supabase/tests/solde_client.test.sql
BEGIN;

-- Le solde stocké suit la formule après chaque mouvement, et ne dépend plus de l'ordre des opérations.
DO $$
DECLARE v_f uuid; v_c uuid; v_p uuid; v_r uuid; v_avant numeric;
BEGIN
  SELECT facture_id, client_id INTO v_f, v_c FROM public.factures
   WHERE statut IN ('impayee','partielle') AND client_id IS NOT NULL
     AND montant_total - COALESCE(montant_paye,0) >= 10 LIMIT 1;
  IF v_f IS NULL THEN RAISE NOTICE 'aucune facture ouverte, test ignoré'; RETURN; END IF;

  PERFORM public._recalc_solde_client_internal(v_c);
  v_avant := public.solde_client_calcule(v_c);
  IF (SELECT solde FROM public.clients WHERE client_id = v_c) <> v_avant THEN
    RAISE EXCEPTION 'solde stocké différent de la formule';
  END IF;

  -- Paiement en attente : aucun effet ; validé : solde diminué (via les triggers seuls).
  INSERT INTO public.paiements(paiement_id, montant, statut, date_paiement)
  VALUES (gen_random_uuid(), 3, 'en_attente_validation', current_date) RETURNING paiement_id INTO v_p;
  INSERT INTO public.payment_allocations(paiement_id, facture_id, montant) VALUES (v_p, v_f, 3);
  IF (SELECT solde FROM public.clients WHERE client_id = v_c) <> v_avant THEN
    RAISE EXCEPTION 'paiement en attente compté dans le solde';
  END IF;
  UPDATE public.paiements SET statut = 'valide' WHERE paiement_id = v_p;
  IF (SELECT solde FROM public.clients WHERE client_id = v_c) <> v_avant - 3 THEN
    RAISE EXCEPTION 'paiement validé non déduit du solde';
  END IF;

  -- Retour : compté seulement une fois validé financièrement, retiré à l'annulation.
  SELECT retour_id INTO v_r FROM public.retours WHERE client_id = v_c LIMIT 1;
  IF v_r IS NULL THEN RAISE NOTICE 'OK paiements (aucun retour pour ce client, suite ignorée)'; RETURN; END IF;
  UPDATE public.retours SET statut = 'attente_validation_compta', montant = 2 WHERE retour_id = v_r;
  v_avant := public.solde_client_calcule(v_c);
  UPDATE public.retours SET statut = 'cloture' WHERE retour_id = v_r;
  IF (SELECT solde FROM public.clients WHERE client_id = v_c) <> v_avant - 2 THEN
    RAISE EXCEPTION 'retour validé non déduit du solde';
  END IF;
  -- Un recalcul (ex. nouveau paiement sur une autre facture) ne doit plus effacer le retour.
  PERFORM public._recalc_solde_client_internal(v_c);
  IF (SELECT solde FROM public.clients WHERE client_id = v_c) <> v_avant - 2 THEN
    RAISE EXCEPTION 'retour effacé par un recalcul';
  END IF;
  UPDATE public.retours SET statut = 'annule' WHERE retour_id = v_r;
  IF (SELECT solde FROM public.clients WHERE client_id = v_c) <> v_avant THEN
    RAISE EXCEPTION 'retour annulé encore déduit';
  END IF;
  RAISE NOTICE 'OK solde client';
END $$;

-- Les audits ne signalent plus d'écart juste après la remise à niveau.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.clients c
              WHERE abs(COALESCE(c.solde,0) - public.solde_client_calcule(c.client_id)) > 0.01) THEN
    RAISE EXCEPTION 'soldes non alignés sur la formule';
  END IF;
  RAISE NOTICE 'OK alignement';
END $$;

ROLLBACK;
