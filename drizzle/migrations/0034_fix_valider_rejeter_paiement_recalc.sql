CREATE OR REPLACE FUNCTION public._recalc_factures_du_paiement(_paiement_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT facture_id FROM public.payment_allocations WHERE paiement_id = _paiement_id
    UNION
    SELECT facture_id FROM public.paiements WHERE paiement_id = _paiement_id AND facture_id IS NOT NULL
  LOOP
    PERFORM public.recalc_facture_from_payment_allocations(r.facture_id);
  END LOOP;
END; $function$;
REVOKE EXECUTE ON FUNCTION public._recalc_factures_du_paiement(uuid) FROM anon, PUBLIC, authenticated;

CREATE OR REPLACE FUNCTION public.valider_paiement(_paiement_id uuid, _commentaire text DEFAULT NULL::text)
 RETURNS SETOF paiements LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.assert_permission('paiements.valider');
  UPDATE public.paiements SET statut='valide', valide_par=auth.uid(), valide_le=now(), commentaire_validation=_commentaire
  WHERE paiement_id=_paiement_id AND statut IN ('en_attente','en_attente_validation');
  IF NOT FOUND THEN RAISE EXCEPTION 'Paiement non validable'; END IF;
  PERFORM public._recalc_factures_du_paiement(_paiement_id);
  RETURN QUERY SELECT * FROM public.paiements WHERE paiement_id=_paiement_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.rejeter_paiement(_paiement_id uuid, _motif text)
 RETURNS SETOF paiements LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.assert_permission('paiements.rejeter');
  UPDATE public.paiements SET statut='rejete', rejete_par=auth.uid(), rejete_le=now(), motif_rejet=_motif
  WHERE paiement_id=_paiement_id AND statut IN ('en_attente','en_attente_validation');
  IF NOT FOUND THEN RAISE EXCEPTION 'Paiement non rejetable'; END IF;
  PERFORM public._recalc_factures_du_paiement(_paiement_id);
  RETURN QUERY SELECT * FROM public.paiements WHERE paiement_id=_paiement_id;
END; $function$;