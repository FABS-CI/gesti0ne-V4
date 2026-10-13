-- Rollback lot 1 : anciennes versions exactes (lues en base le 2026-10-13)
-- La colonne retours.avoir_facture_id et les tables audit_correction_f15 / retours_suppression_audit restent (sans danger).

CREATE OR REPLACE FUNCTION public.recalc_facture_from_payment_allocations(_facture_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total numeric; v_paye numeric; v_client uuid; v_statut text;
BEGIN
  SELECT montant_total, client_id, statut INTO v_total, v_client, v_statut
  FROM public.factures WHERE facture_id = _facture_id;
  IF v_total IS NULL THEN RETURN; END IF;

  SELECT COALESCE(sum(pa.montant), 0) INTO v_paye
  FROM public.payment_allocations pa
  JOIN public.paiements p ON p.paiement_id = pa.paiement_id
  WHERE pa.facture_id = _facture_id AND p.statut NOT IN ('annule', 'rejete');

  IF v_statut = 'annulee' THEN
    UPDATE public.factures SET montant_paye = v_paye WHERE facture_id = _facture_id;
  ELSE
    UPDATE public.factures SET
      montant_paye = v_paye,
      statut = CASE WHEN v_paye >= v_total THEN 'payee' WHEN v_paye > 0 THEN 'partielle' ELSE 'impayee' END
    WHERE facture_id = _facture_id;
  END IF;

  PERFORM public._recalc_solde_client_internal(v_client);
END; $function$;

CREATE OR REPLACE FUNCTION public.rapport_produits_encaissement(_date_debut date DEFAULT NULL::date, _date_fin date DEFAULT NULL::date)
 RETURNS TABLE(produit_id uuid, reference_produit text, designation text, ca_encaisse numeric, nb_paiements bigint, nb_factures bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    pl.produit_id,
    max(cl.reference_produit) AS reference_produit,
    max(COALESCE(pl.designation, cl.designation)) AS designation,
    sum(pl.montant) AS ca_encaisse,
    count(DISTINCT p.paiement_id) AS nb_paiements,
    count(DISTINCT pa.facture_id) AS nb_factures
  FROM public.payment_line_allocations pl
  JOIN public.payment_allocations pa ON pa.allocation_id = pl.allocation_id
  JOIN public.paiements p ON p.paiement_id = pa.paiement_id
  LEFT JOIN public.commande_lignes cl ON cl.ligne_id = pl.ligne_id
  WHERE p.statut NOT IN ('annule','rejete')
    AND (_date_debut IS NULL OR p.date_paiement >= _date_debut)
    AND (_date_fin IS NULL OR p.date_paiement <= _date_fin)
  GROUP BY pl.produit_id
$function$;

CREATE OR REPLACE FUNCTION public.report_reconciliation_finance()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'directeur_general') OR public.has_role(auth.uid(),'comptable') OR public.has_role(auth.uid(),'assistante_comptable')) THEN
    RAISE EXCEPTION 'Permission refusée' USING ERRCODE='42501';
  END IF;
  WITH alloc AS (
    SELECT a.facture_id, sum(a.montant) paye FROM public.payment_allocations a
    JOIN public.paiements p ON p.paiement_id=a.paiement_id
    WHERE p.statut NOT IN ('annule','rejete') GROUP BY a.facture_id
  ), fx AS (
    SELECT f.facture_id, f.reference, f.client_nom, f.montant_total total,
      COALESCE(al.paye,0) paye_calc, COALESCE(f.montant_paye,0) paye_enr
    FROM public.factures f LEFT JOIN alloc al USING (facture_id)
    WHERE f.statut <> 'annulee'
  ), cl AS (
    SELECT c.client_id, c.nom, COALESCE(c.solde,0) solde_enr,
      COALESCE((SELECT sum(f.montant_total - COALESCE(al.paye,0)) FROM public.factures f
        LEFT JOIN alloc al USING (facture_id)
        WHERE f.client_id=c.client_id AND f.statut<>'annulee'),0) solde_calc
    FROM public.clients c
  )
  SELECT jsonb_build_object(
    'clients', COALESCE((SELECT jsonb_agg(jsonb_build_object('client_id',client_id,'nom',nom,
        'solde_calcule',solde_calc,'solde_enregistre',solde_enr,'ecart',solde_calc-solde_enr) ORDER BY abs(solde_calc-solde_enr) DESC)
      FROM cl WHERE abs(solde_calc-solde_enr)>0.5),'[]'::jsonb),
    'factures', COALESCE((SELECT jsonb_agg(jsonb_build_object('facture_id',facture_id,'reference',reference,'client',client_nom,
        'total',total,'paye_calcule',paye_calc,'paye_enregistre',paye_enr,'reste_calcule',total-paye_calc,
        'reste_enregistre',total-paye_enr,'ecart',paye_enr-paye_calc))
      FROM fx WHERE abs(paye_calc-paye_enr)>0.5),'[]'::jsonb),
    'paiements', jsonb_build_object(
      'actifs', (SELECT COALESCE(sum(montant),0) FROM public.paiements WHERE statut NOT IN ('annule','rejete')),
      'annules', (SELECT COALESCE(sum(montant),0) FROM public.paiements WHERE statut IN ('annule','rejete')),
      'affectes', (SELECT COALESCE(sum(a.montant),0) FROM public.payment_allocations a JOIN public.paiements p ON p.paiement_id=a.paiement_id WHERE p.statut NOT IN ('annule','rejete')),
      'supprimes', (SELECT COALESCE(sum(montant_annule),0) FROM public.paiement_annulations_audit WHERE raison='suppression_definitive'))
  ) INTO v;
  RETURN v;
END; $function$;

CREATE OR REPLACE FUNCTION public._retour_valider_compta_core(_retour_id uuid, _option text, _montants jsonb, _commentaire text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

CREATE OR REPLACE FUNCTION public.annuler_retour(_retour_id uuid, _motif text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_r public.retours;
  r record;
  v_new_stock numeric;
BEGIN
  PERFORM public.assert_permission('retours.annuler');
  SELECT * INTO v_r FROM public.retours WHERE retour_id = _retour_id FOR UPDATE;
  IF v_r.retour_id IS NULL THEN RAISE EXCEPTION 'Retour introuvable'; END IF;
  IF v_r.statut = 'annule' THEN RAISE EXCEPTION 'Retour déjà annulé'; END IF;

  -- Retirer du stock ce qui avait été réintégré (physique uniquement)
  IF v_r.type_retour = 'physique' AND v_r.depot_id IS NOT NULL THEN
    FOR r IN SELECT produit_id, quantite, motif FROM public.retour_lignes
             WHERE retour_id = _retour_id AND produit_id IS NOT NULL AND quantite > 0 LOOP
      INSERT INTO public.stocks_depots(produit_id, depot_id, quantite)
      VALUES (r.produit_id, v_r.depot_id, -r.quantite)
      ON CONFLICT (produit_id, depot_id) DO UPDATE
        SET quantite = public.stocks_depots.quantite - r.quantite, updated_at = now();
      SELECT quantite INTO v_new_stock FROM public.stocks_depots
        WHERE produit_id=r.produit_id AND depot_id=v_r.depot_id;
      INSERT INTO public.stock_mouvements(
        produit_id, depot_id, type, quantite, quantite_entree, quantite_sortie,
        stock_resultant, origine, document_id, document_reference, document_table,
        user_id, motif
      ) VALUES (
        r.produit_id, v_r.depot_id, 'sortie', r.quantite, 0, r.quantite, v_new_stock,
        'annulation_retour', _retour_id, v_r.reference, 'retours', auth.uid(),
        COALESCE(_motif,'Annulation retour')
      );
    END LOOP;
  END IF;

  -- Inverser l'impact compte client
  IF v_r.montant > 0 AND v_r.client_id IS NOT NULL THEN
    IF v_r.facture_id IS NOT NULL THEN
      UPDATE public.factures
         SET montant_total = montant_total + v_r.montant, updated_at = now()
       WHERE facture_id = v_r.facture_id;
      UPDATE public.factures
         SET statut = CASE
           WHEN COALESCE(montant_paye,0) >= montant_total THEN 'payee'
           WHEN COALESCE(montant_paye,0) > 0 THEN 'partielle'
           ELSE 'impayee' END
       WHERE facture_id = v_r.facture_id;
      PERFORM public._recalc_solde_client_internal(v_r.client_id);
    ELSE
      UPDATE public.clients
         SET solde = COALESCE(solde,0) + v_r.montant, updated_at = now()
       WHERE client_id = v_r.client_id;
    END IF;
  END IF;

  UPDATE public.retours
     SET statut = 'annule',
         notes = COALESCE(_motif, notes),
         updated_at = now()
   WHERE retour_id = _retour_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.supprimer_retour_definitif(_retour_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean;
  v_statut text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_uid AND role = 'super_admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Suppression réservée aux super administrateurs';
  END IF;

  SELECT statut INTO v_statut
  FROM public.retours
  WHERE retour_id = _retour_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Retour introuvable';
  END IF;

  -- Inverse les effets si le retour est toujours "accepté"
  IF v_statut IS DISTINCT FROM 'annule' THEN
    BEGIN
      PERFORM public.annuler_retour(_retour_id);
    EXCEPTION WHEN OTHERS THEN
      -- Le super_admin force malgré tout la suppression
      NULL;
    END;
  END IF;

  DELETE FROM public.retour_lignes WHERE retour_id = _retour_id;
  DELETE FROM public.retours WHERE retour_id = _retour_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.executer_transfert(_transfert_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_source uuid;
  v_dest uuid;
  v_statut text;
  r record;
  v_stock numeric;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'transferts.executer') THEN
    RAISE EXCEPTION 'Permission refusée : transferts.executer' USING ERRCODE = '42501';
  END IF;

  SELECT depot_source_id, depot_destination_id, statut
    INTO v_source, v_dest, v_statut
  FROM public.transferts WHERE transfert_id = _transfert_id;

  IF v_source IS NULL THEN RAISE EXCEPTION 'Transfert introuvable'; END IF;
  IF v_statut <> 'brouillon' THEN RAISE EXCEPTION 'Statut invalide : %', v_statut; END IF;

  FOR r IN
    SELECT produit_id, quantite FROM public.transfert_lignes WHERE transfert_id = _transfert_id
  LOOP
    SELECT COALESCE(quantite, 0) INTO v_stock
    FROM public.stocks_depots
    WHERE produit_id = r.produit_id AND depot_id = v_source;

    IF COALESCE(v_stock, 0) < r.quantite THEN
      RAISE EXCEPTION 'Stock insuffisant pour produit %', r.produit_id;
    END IF;

    UPDATE public.stocks_depots
    SET quantite = quantite - r.quantite, updated_at = now()
    WHERE produit_id = r.produit_id AND depot_id = v_source;

    INSERT INTO public.stock_mouvements(produit_id, depot_id, type, quantite,
      quantite_entree, quantite_sortie, stock_resultant,
      origine, document_id, user_id)
    SELECT r.produit_id, v_source, 'sortie', r.quantite,
      0, r.quantite, quantite,
      'transfert_sortant', _transfert_id, auth.uid()
    FROM public.stocks_depots
    WHERE produit_id = r.produit_id AND depot_id = v_source;
  END LOOP;

  UPDATE public.transferts
  SET statut = 'expedie', date_expedition = now()
  WHERE transfert_id = _transfert_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.receptionner_transfert(_transfert_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_dest uuid;
  v_statut text;
  r record;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'transferts.receptionner') THEN
    RAISE EXCEPTION 'Permission refusée : transferts.receptionner' USING ERRCODE = '42501';
  END IF;

  SELECT depot_destination_id, statut INTO v_dest, v_statut
  FROM public.transferts WHERE transfert_id = _transfert_id;

  IF v_dest IS NULL THEN RAISE EXCEPTION 'Transfert introuvable'; END IF;
  IF v_statut <> 'expedie' THEN RAISE EXCEPTION 'Statut invalide : %', v_statut; END IF;

  FOR r IN
    SELECT produit_id, quantite FROM public.transfert_lignes WHERE transfert_id = _transfert_id
  LOOP
    INSERT INTO public.stocks_depots(produit_id, depot_id, quantite)
    VALUES (r.produit_id, v_dest, r.quantite)
    ON CONFLICT (produit_id, depot_id) DO UPDATE
      SET quantite = public.stocks_depots.quantite + EXCLUDED.quantite,
          updated_at = now();

    UPDATE public.transfert_lignes
    SET quantite_recue = r.quantite
    WHERE transfert_id = _transfert_id AND produit_id = r.produit_id;

    INSERT INTO public.stock_mouvements(produit_id, depot_id, type, quantite,
      quantite_entree, quantite_sortie, stock_resultant,
      origine, document_id, user_id)
    SELECT r.produit_id, v_dest, 'entree', r.quantite,
      r.quantite, 0, quantite,
      'transfert_entrant', _transfert_id, auth.uid()
    FROM public.stocks_depots
    WHERE produit_id = r.produit_id AND depot_id = v_dest;
  END LOOP;

  UPDATE public.transferts
  SET statut = 'recu', date_reception = now()
  WHERE transfert_id = _transfert_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.annuler_transfert(_transfert_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_permission(auth.uid(), 'transferts.annuler') THEN
    RAISE EXCEPTION 'Permission refusée : transferts.annuler' USING ERRCODE = '42501';
  END IF;

  UPDATE public.transferts SET statut = 'annule'
  WHERE transfert_id = _transfert_id AND statut IN ('brouillon', 'expedie');
END;
$function$;

CREATE OR REPLACE FUNCTION public.valider_commande(_commande_id uuid, _type_frais_transport text DEFAULT NULL::text, _montant_frais_transport numeric DEFAULT NULL::numeric)
 RETURNS TABLE(facture_reference text, bl_reference text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cmd public.commandes;
  v_f_ref text := public._next_ref('FAC', 'public.factures', 'reference');
  v_bl_ref text := public._next_ref('BL', 'public.bons_livraison', 'reference');
  v_bl_id uuid;
  v_depot uuid;
  r record;
  v_dispo numeric;
  v_new_stock numeric;
  v_type text := NULLIF(btrim(COALESCE(_type_frais_transport, '')), '');
  v_frais numeric;
  v_total numeric;
BEGIN
  PERFORM public.assert_permission('commandes.valider');

  -- Contrôle du couple type / montant
  IF v_type IS NULL THEN
    IF COALESCE(_montant_frais_transport, 0) <> 0 THEN
      RAISE EXCEPTION 'Montant de transport sans type de frais de transport' USING ERRCODE = 'P0001';
    END IF;
    v_frais := NULL;
  ELSE
    IF v_type NOT IN ('livraison', 'expedition') THEN
      RAISE EXCEPTION 'Type de frais de transport invalide : %', v_type USING ERRCODE = 'P0001';
    END IF;
    IF _montant_frais_transport IS NULL THEN
      RAISE EXCEPTION 'Montant requis pour les frais de %', v_type USING ERRCODE = 'P0001';
    END IF;
    IF _montant_frais_transport < 0 THEN
      RAISE EXCEPTION 'Le montant des frais de transport ne peut pas être négatif' USING ERRCODE = 'P0001';
    END IF;
    v_frais := _montant_frais_transport;
  END IF;

  SELECT * INTO v_cmd FROM public.commandes WHERE commande_id = _commande_id FOR UPDATE;
  IF v_cmd.commande_id IS NULL THEN RAISE EXCEPTION 'Commande introuvable'; END IF;
  IF v_cmd.statut = 'validee' THEN RAISE EXCEPTION 'Commande déjà validée'; END IF;
  IF v_cmd.statut = 'annulee' THEN RAISE EXCEPTION 'Commande annulée, impossible à valider'; END IF;

  v_depot := v_cmd.depot_id;
  IF v_depot IS NULL THEN
    SELECT depot_id INTO v_depot FROM public.depots WHERE is_principal = true LIMIT 1;
  END IF;
  IF v_depot IS NULL THEN
    RAISE EXCEPTION 'Aucun dépôt défini (ni sur la commande, ni comme dépôt principal)';
  END IF;

  -- 1) Décrément stock ligne par ligne (blocage si insuffisant)
  FOR r IN
    SELECT cl.produit_id, cl.quantite, cl.designation
    FROM public.commande_lignes cl
    WHERE cl.commande_id = _commande_id AND cl.produit_id IS NOT NULL
  LOOP
    SELECT quantite INTO v_dispo
    FROM public.stocks_depots
    WHERE produit_id = r.produit_id AND depot_id = v_depot
    FOR UPDATE;

    v_dispo := COALESCE(v_dispo, 0);
    IF v_dispo < r.quantite THEN
      RAISE EXCEPTION 'Stock insuffisant pour "%": disponible %, demandé %',
        r.designation, v_dispo, r.quantite USING ERRCODE = 'P0001';
    END IF;

    v_new_stock := v_dispo - r.quantite;

    UPDATE public.stocks_depots
    SET quantite = v_new_stock, updated_at = now()
    WHERE produit_id = r.produit_id AND depot_id = v_depot;

    INSERT INTO public.stock_mouvements(
      produit_id, depot_id, type, quantite,
      quantite_entree, quantite_sortie, stock_resultant,
      origine, document_id, document_reference, document_table,
      user_id, motif
    ) VALUES (
      r.produit_id, v_depot, 'sortie', r.quantite,
      0, r.quantite, v_new_stock,
      'vente', _commande_id, v_cmd.reference, 'commandes',
      auth.uid(), 'Validation commande ' || COALESCE(v_cmd.reference,'')
    );
  END LOOP;

  -- 2) Frais de transport sur la commande + total facturé
  UPDATE public.commandes
  SET type_frais_transport = v_type,
      montant_frais_transport = v_frais
  WHERE commande_id = _commande_id;

  v_total := COALESCE(v_cmd.montant_total, 0) + COALESCE(v_frais, 0);

  -- 3) Facture + BL
  INSERT INTO public.factures(
    reference, client_id, client_nom, commande_id, exercice_id,
    date_facture, date_echeance, montant_total, statut,
    type_frais_transport, montant_frais_transport
  ) VALUES (
    v_f_ref, v_cmd.client_id, v_cmd.client_nom, _commande_id, v_cmd.exercice_id,
    current_date, current_date + 30, v_total, 'impayee',
    v_type, v_frais
  );

  INSERT INTO public.bons_livraison(
    reference, commande_id, client_id, client_nom, date_emission, statut, exercice_id
  ) VALUES (
    v_bl_ref, _commande_id, v_cmd.client_id, v_cmd.client_nom, current_date, 'a_preparer', v_cmd.exercice_id
  ) RETURNING bl_id INTO v_bl_id;

  UPDATE public.commandes SET statut = 'validee' WHERE commande_id = _commande_id;

  -- 4) Recalc solde client (nouvelle créance)
  PERFORM public._recalc_solde_client_internal(v_cmd.client_id);

  RETURN QUERY SELECT v_f_ref, v_bl_ref;
END; $function$;
