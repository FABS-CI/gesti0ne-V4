CREATE OR REPLACE FUNCTION public.supprimer_paiement_definitif(_paiement_id uuid, _motif text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.paiements;
  v_factures uuid[];
  v_fid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'super_admin') THEN
    RAISE EXCEPTION 'Permission refusée' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_row FROM public.paiements WHERE paiement_id = _paiement_id FOR UPDATE;
  IF v_row.paiement_id IS NULL THEN RAISE EXCEPTION 'Paiement introuvable'; END IF;

  -- Toutes les factures touchées (affectations multi-factures + lien historique)
  SELECT array_agg(DISTINCT f) INTO v_factures FROM (
    SELECT facture_id AS f FROM public.payment_allocations WHERE paiement_id = _paiement_id
    UNION SELECT v_row.facture_id WHERE v_row.facture_id IS NOT NULL
  ) s WHERE f IS NOT NULL;

  INSERT INTO public.paiement_annulations_audit(paiement_id, facture_id, annule_par, raison, notes, montant_annule)
  VALUES (_paiement_id, v_row.facture_id, auth.uid(), 'suppression_definitive', _motif, v_row.montant);

  DELETE FROM public.paiements WHERE paiement_id = _paiement_id; -- allocations supprimées en cascade

  -- Recalcul depuis la source de vérité (affectations) : facture + solde client
  IF v_factures IS NOT NULL THEN
    FOREACH v_fid IN ARRAY v_factures LOOP
      PERFORM public.recalc_facture_from_payment_allocations(v_fid);
    END LOOP;
  END IF;

  RETURN jsonb_build_object('paiement_id', _paiement_id, 'reference', v_row.reference, 'motif', _motif,
                            'factures_recalculees', COALESCE(array_length(v_factures,1),0));
END; $function$;