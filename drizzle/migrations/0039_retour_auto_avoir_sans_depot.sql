CREATE OR REPLACE FUNCTION public._retour_traiter_auto(_retour_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_retour public.retours; v_lignes jsonb; v_valeur numeric;
BEGIN
  SELECT * INTO v_retour FROM public.retours WHERE retour_id=_retour_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Retour introuvable'; END IF;
  IF v_retour.depot_id IS NULL AND COALESCE(v_retour.type_retour,'physique') <> 'avoir' AND EXISTS (SELECT 1 FROM public.retour_lignes
       WHERE retour_id=_retour_id AND COALESCE(etat_produit,'revendable')='revendable') THEN
    RAISE EXCEPTION 'Dépôt de réception obligatoire pour réintégrer le stock';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'ligne_id', ligne_id,
      'quantite_recue', COALESCE(quantite_demandee, quantite, 0),
      'etat_reception', CASE COALESCE(etat_produit,'revendable')
                          WHEN 'revendable' THEN 'conforme'
                          WHEN 'endommage' THEN 'endommage' ELSE 'manquant' END)), '[]'::jsonb)
  INTO v_lignes FROM public.retour_lignes WHERE retour_id=_retour_id;
  IF jsonb_array_length(v_lignes) = 0 THEN RAISE EXCEPTION 'Retour sans ligne'; END IF;

  PERFORM public._retour_receptionner_core(_retour_id, v_lignes);

  SELECT COALESCE(SUM(COALESCE(total_ligne, COALESCE(quantite_recue,quantite,0)*COALESCE(prix_unitaire,0))),0)
  INTO v_valeur FROM public.retour_lignes WHERE retour_id=_retour_id;

  PERFORM public._retour_valider_compta_core(_retour_id, 'diminuer_solde',
    jsonb_build_object('valeur_retour', v_valeur), 'Validation automatique à la création');

  PERFORM public._retour_audit(_retour_id,'retour.traite_automatiquement',
    jsonb_build_object('valeur_retour', v_valeur));
END$function$;