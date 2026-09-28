-- Cœur de la réception (sans contrôle de permission ni de version : appelé par des fonctions qui les font)
CREATE OR REPLACE FUNCTION public._retour_receptionner_core(_retour_id uuid, _lignes jsonb)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_retour public.retours; v_user_nom text := public._current_user_display_name();
  v_ligne jsonb; v_appr_id uuid; v_numero text;
  v_etat text; v_etat_produit text; v_qte numeric; v_produit uuid; v_new_stock numeric;
BEGIN
  SELECT * INTO v_retour FROM public.retours WHERE retour_id=_retour_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Retour introuvable'; END IF;
  IF v_retour.statut NOT IN ('demande_creee','attente_reception') THEN
    RAISE EXCEPTION 'Statut invalide : %', v_retour.statut;
  END IF;
  v_numero := COALESCE(v_retour.numero,v_retour.reference,_retour_id::text);

  FOR v_ligne IN SELECT * FROM jsonb_array_elements(_lignes) LOOP
    v_qte  := COALESCE((v_ligne->>'quantite_recue')::numeric,0);
    v_etat := COALESCE(NULLIF(v_ligne->>'etat_reception',''),'conforme');
    v_etat_produit := CASE v_etat WHEN 'conforme' THEN 'revendable'
                                  WHEN 'endommage' THEN 'endommage' ELSE 'perdu' END;
    UPDATE public.retour_lignes SET quantite_recue=v_qte, etat_reception=v_etat,
      etat_produit=v_etat_produit,
      commentaire_reception=NULLIF(v_ligne->>'commentaire_reception','')
    WHERE ligne_id=(v_ligne->>'ligne_id')::uuid AND retour_id=_retour_id
    RETURNING produit_id INTO v_produit;

    IF v_produit IS NOT NULL AND v_qte > 0 AND v_retour.depot_id IS NOT NULL THEN
      IF v_etat_produit = 'revendable' THEN
        INSERT INTO public.stocks_depots (produit_id, depot_id, quantite)
        VALUES (v_produit, v_retour.depot_id, v_qte)
        ON CONFLICT (produit_id, depot_id) DO UPDATE
          SET quantite = public.stocks_depots.quantite + EXCLUDED.quantite, updated_at=now();
        SELECT quantite INTO v_new_stock FROM public.stocks_depots
          WHERE produit_id=v_produit AND depot_id=v_retour.depot_id;
        INSERT INTO public.stock_mouvements (produit_id, depot_id, type, quantite, quantite_entree,
          stock_resultant, motif, origine, document_id, document_reference, document_table, user_id, user_nom)
        VALUES (v_produit, v_retour.depot_id, 'entree', v_qte, v_qte, v_new_stock,
          'Retour client (revendable)', 'retour', _retour_id, v_numero, 'retours', auth.uid(), v_user_nom);
      ELSE
        SELECT quantite INTO v_new_stock FROM public.stocks_depots
          WHERE produit_id=v_produit AND depot_id=v_retour.depot_id;
        INSERT INTO public.stock_mouvements (produit_id, depot_id, type, quantite, quantite_entree,
          quantite_sortie, stock_resultant, motif, origine, document_id, document_reference,
          document_table, user_id, user_nom, observation)
        VALUES (v_produit, v_retour.depot_id, 'perte', v_qte, 0, 0, COALESCE(v_new_stock,0),
          'Retour client ('||v_etat_produit||') — non réintégré', 'retour', _retour_id, v_numero,
          'retours', auth.uid(), v_user_nom, NULLIF(v_ligne->>'commentaire_reception',''));
      END IF;
    END IF;
  END LOOP;

  UPDATE public.retours SET statut='attente_validation_compta', receptionne_par=auth.uid(),
    receptionne_par_nom=v_user_nom, receptionne_at=now(), version_no=version_no+1, updated_at=now()
  WHERE retour_id=_retour_id;

  UPDATE public.workflow_approvals SET statut='valide', approbateur_id=auth.uid(),
    approbateur_nom=v_user_nom, decided_at=now(), version_no=version_no+1
  WHERE id=v_retour.workflow_approval_id;

  INSERT INTO public.workflow_approvals (workflow_code, module, entity_type, entity_id, reference,
    statut, demandeur_id, demandeur_nom, metadata)
  VALUES ('retour_valider_compta','retours','retour',_retour_id,v_numero,'en_attente',
    auth.uid(), v_user_nom, jsonb_build_object('etape','validation_comptable'))
  RETURNING id INTO v_appr_id;
  UPDATE public.retours SET workflow_approval_id=v_appr_id WHERE retour_id=_retour_id;

  PERFORM public._retour_audit(_retour_id,'retour.receptionne',
    jsonb_build_object('lignes',_lignes,'depot_id',v_retour.depot_id));
END$function$;

CREATE OR REPLACE FUNCTION public.retour_receptionner(_retour_id uuid, _version integer, _lignes jsonb)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_retour public.retours; v_numero text; v_appr uuid;
BEGIN
  IF NOT public.has_permission(auth.uid(),'retours.receptionner') THEN
    RAISE EXCEPTION 'Permission refusée' USING ERRCODE='insufficient_privilege';
  END IF;
  SELECT * INTO v_retour FROM public.retours WHERE retour_id=_retour_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Retour introuvable'; END IF;
  IF v_retour.version_no <> _version THEN
    RAISE EXCEPTION 'CONFLIT_VERSION' USING ERRCODE='serialization_failure';
  END IF;
  PERFORM public._retour_receptionner_core(_retour_id, _lignes);
  SELECT COALESCE(numero,reference,_retour_id::text), workflow_approval_id INTO v_numero, v_appr
    FROM public.retours WHERE retour_id=_retour_id;
  PERFORM public._notifier_role('comptable','Retour à valider financièrement',
    'Retour '||v_numero||' réceptionné','/approbations/'||v_appr,'retours','retour',_retour_id,v_numero);
END$function$;

-- Cœur de la validation comptable (sans contrôle de permission ni de version)
CREATE OR REPLACE FUNCTION public._retour_valider_compta_core(_retour_id uuid, _option text, _montants jsonb, _commentaire text DEFAULT NULL)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_retour public.retours; v_user_nom text := public._current_user_display_name();
  v_valeur numeric := COALESCE((_montants->>'valeur_retour')::numeric, COALESCE((_montants->>'montant_total')::numeric, 0));
BEGIN
  IF _option NOT IN ('diminuer_solde','creer_avoir','preparer_remboursement','aucun_impact') THEN
    RAISE EXCEPTION 'Option invalide : %', _option;
  END IF;
  SELECT * INTO v_retour FROM public.retours WHERE retour_id=_retour_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Retour introuvable'; END IF;
  IF v_retour.statut <> 'attente_validation_compta' THEN
    RAISE EXCEPTION 'Statut invalide : %', v_retour.statut;
  END IF;
  IF v_retour.exercice_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.exercices_comptables
       WHERE exercice_id=v_retour.exercice_id AND statut='cloture') THEN
    RAISE EXCEPTION 'Exercice comptable clôturé';
  END IF;

  IF _option='diminuer_solde' AND v_retour.client_id IS NOT NULL THEN
    UPDATE public.clients SET solde=COALESCE(solde,0)-v_valeur, updated_at=now()
    WHERE client_id=v_retour.client_id;
  END IF;

  IF _option='creer_avoir' AND v_retour.client_id IS NOT NULL THEN
    INSERT INTO public.factures (reference, client_id, client_nom, commande_id, exercice_id,
      date_facture, montant_total, statut, notes, type_facture)
    VALUES ('AV-'||to_char(now(),'YYYYMMDD')||'-'||substr(gen_random_uuid()::text,1,6),
      v_retour.client_id, v_retour.client_nom, v_retour.commande_id, v_retour.exercice_id,
      CURRENT_DATE, -v_valeur, 'avoir', 'Avoir sur retour '||COALESCE(v_retour.numero,v_retour.reference), 'avoir');
  END IF;

  UPDATE public.retours SET statut='cloture', valide_compta_par=auth.uid(), valide_compta_par_nom=v_user_nom,
    valide_compta_at=now(), version_no=version_no+1, updated_at=now(), montant=v_valeur
  WHERE retour_id=_retour_id;

  IF _option='diminuer_solde' THEN PERFORM public.generate_ecriture_retour(_retour_id); END IF;

  UPDATE public.workflow_approvals SET statut='valide', approbateur_id=auth.uid(), approbateur_nom=v_user_nom,
    decided_at=now(), commentaire=_commentaire,
    decision_details=jsonb_build_object('option',_option,'montants',_montants), simulation_financiere=_montants
  WHERE id=v_retour.workflow_approval_id;

  PERFORM public._retour_audit(_retour_id,'retour.valide_compta',
    jsonb_build_object('option',_option,'montants',_montants));

  INSERT INTO public.notifications(titre,message,type_notification,priorite,module,lien,document_type,document_id,document_reference,user_id)
  VALUES ('Retour validé financièrement','Option : '||_option||' - Montant : '||v_valeur::text,
          'workflow','normal','retours','/retours/'||_retour_id,'retour',_retour_id,
          COALESCE(v_retour.numero,v_retour.reference), v_retour.created_by);
END; $function$;

CREATE OR REPLACE FUNCTION public.retour_valider_compta(_retour_id uuid, _version integer, _option text, _montants jsonb, _commentaire text DEFAULT NULL::text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_retour public.retours;
BEGIN
  IF NOT public.has_permission(auth.uid(),'retours.valider_compta') THEN
    RAISE EXCEPTION 'Permission refusée' USING ERRCODE='insufficient_privilege';
  END IF;
  SELECT * INTO v_retour FROM public.retours WHERE retour_id=_retour_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Retour introuvable'; END IF;
  IF v_retour.version_no <> _version THEN
    RAISE EXCEPTION 'CONFLIT_VERSION' USING ERRCODE='serialization_failure';
  END IF;
  PERFORM public._retour_valider_compta_core(_retour_id, _option, _montants, _commentaire);
END; $function$;

-- Traitement automatique complet d'un retour existant (réception intégrale + réduction de la dette client)
CREATE OR REPLACE FUNCTION public._retour_traiter_auto(_retour_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_retour public.retours; v_lignes jsonb; v_valeur numeric;
BEGIN
  SELECT * INTO v_retour FROM public.retours WHERE retour_id=_retour_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Retour introuvable'; END IF;
  IF v_retour.depot_id IS NULL AND EXISTS (SELECT 1 FROM public.retour_lignes
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

-- Point d'entrée du nouveau parcours : création + traitement complet, atomique
CREATE OR REPLACE FUNCTION public.retour_creer_et_valider(_payload jsonb)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_id uuid;
BEGIN
  IF NOT public.has_permission(auth.uid(),'retours.creer') THEN
    RAISE EXCEPTION 'Permission refusée' USING ERRCODE='insufficient_privilege';
  END IF;
  v_id := public.retour_creer_demande(_payload);
  PERFORM public._retour_traiter_auto(v_id);
  RETURN v_id;
END$function$;

REVOKE ALL ON FUNCTION public._retour_receptionner_core(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._retour_valider_compta_core(uuid, text, jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._retour_traiter_auto(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.retour_creer_et_valider(jsonb) TO authenticated;