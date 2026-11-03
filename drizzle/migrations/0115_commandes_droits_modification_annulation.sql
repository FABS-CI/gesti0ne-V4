-- Commandes : droits de modification / suppression, modification après validation,
-- annulation et fonctions anciennes.
--
-- Règles :
--   * brouillon : modifiable (et supprimable) par qui peut créer des commandes ;
--   * à partir de « en attente de validation » : droit commandes.modifier pour modifier,
--     commandes.supprimer pour supprimer (contrôlés par le serveur, plus seulement par l'écran) ;
--   * une commande validée reste modifiable tant que la marchandise n'est pas partie :
--     le stock suit les quantités et la facture est recalculée ; refus si la facture est
--     déclarée à la DGI ou si le nouveau total est inférieur à ce qui est déjà payé ;
--   * une commande dont la marchandise est partie ne s'annule plus : il faut faire un retour.
--     Avant départ, l'annulation remet le stock et annule facture et BL quel que soit le statut ;
--   * creer_retour (ancien retour sans contrôle) et convertir_commande_en_bl (BL avec sortie
--     de stock sans facture) ne sont plus appelables depuis l'application.

-- Statuts d'avant validation : aucun stock sorti, aucune facture.
CREATE OR REPLACE FUNCTION public._commande_avant_validation(_statut text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(_statut, '') IN ('brouillon', 'soumise', 'en_attente', 'en_attente_validation', 'confirmee');
$$;

-- Marchandise partie : commande en livraison / livrée, ou suivi de livraison au-delà de « préparée ».
CREATE OR REPLACE FUNCTION public._commande_marchandise_partie(_commande_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.commandes c
                  WHERE c.commande_id = _commande_id AND c.statut IN ('livraison_en_cours', 'livree'))
      OR EXISTS (SELECT 1 FROM public.livsuivi_commandes l
                  WHERE l.commande_id = _commande_id AND l.statut::text <> 'preparee');
$$;
REVOKE EXECUTE ON FUNCTION public._commande_marchandise_partie(uuid) FROM public, anon, authenticated;

-- Facture de la commande acceptée par la DGI (FNE).
CREATE OR REPLACE FUNCTION public._commande_facture_dgi(_commande_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.factures f JOIN public.fne_factures n ON n.facture_id = f.facture_id
                  WHERE f.commande_id = _commande_id AND n.statut = 'accepted');
$$;
REVOKE EXECUTE ON FUNCTION public._commande_facture_dgi(uuid) FROM public, anon, authenticated;

-- Droit sur une commande selon son statut : brouillon → créer ou <droit> ; sinon <droit>.
CREATE OR REPLACE FUNCTION public._commande_assert_droit(_statut text, _droit text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE(_statut, '') = 'brouillon' AND auth.uid() IS NOT NULL
     AND public.has_permission_v2(auth.uid(), 'commandes.creer') THEN
    RETURN;
  END IF;
  PERFORM public.assert_permission(_droit);
END $$;
REVOKE EXECUTE ON FUNCTION public._commande_assert_droit(text, text) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.modifier_commande(_commande_id uuid, _payload jsonb)
 RETURNS SETOF commandes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cmd public.commandes;
  v_validee boolean;
  v_depot uuid;
  v_avant jsonb := '{}'::jsonb;
  v_apres jsonb := '{}'::jsonb;
  r record;
  v_delta numeric;
  v_dispo numeric;
  v_new_stock numeric;
BEGIN
  SELECT * INTO v_cmd FROM public.commandes WHERE commande_id = _commande_id FOR UPDATE;
  IF v_cmd.commande_id IS NULL THEN RAISE EXCEPTION 'Commande introuvable'; END IF;
  PERFORM public._commande_assert_droit(v_cmd.statut, 'commandes.modifier');
  IF v_cmd.statut = 'annulee' THEN
    RAISE EXCEPTION 'Commande annulée : modification impossible' USING ERRCODE = 'P0001';
  END IF;

  v_validee := NOT public._commande_avant_validation(v_cmd.statut);
  IF v_validee THEN
    IF public._commande_marchandise_partie(_commande_id) THEN
      RAISE EXCEPTION 'La marchandise est partie : modification impossible, faites un retour' USING ERRCODE = 'P0001';
    END IF;
    IF public._commande_facture_dgi(_commande_id) THEN
      RAISE EXCEPTION 'La facture est déclarée à la DGI : modification impossible, faites un avoir' USING ERRCODE = 'P0001';
    END IF;
    IF NULLIF(_payload->>'client_id', '')::uuid IS DISTINCT FROM NULL
       AND NULLIF(_payload->>'client_id', '')::uuid <> v_cmd.client_id THEN
      RAISE EXCEPTION 'Commande validée : le client ne peut plus être changé' USING ERRCODE = 'P0001';
    END IF;
    IF NULLIF(_payload->>'depot_id', '')::uuid IS DISTINCT FROM NULL
       AND NULLIF(_payload->>'depot_id', '')::uuid IS DISTINCT FROM v_cmd.depot_id THEN
      RAISE EXCEPTION 'Commande validée : le dépôt ne peut plus être changé' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  UPDATE public.commandes SET
    client_id = COALESCE(NULLIF(_payload->>'client_id','')::uuid, client_id),
    client_nom = COALESCE(_payload->>'client_nom', client_nom),
    etablissement = COALESCE(_payload->>'etablissement', etablissement),
    representant_nom = COALESCE(_payload->>'representant_nom', representant_nom),
    telephone = COALESCE(_payload->>'telephone', telephone),
    ville = COALESCE(_payload->>'ville', ville),
    adresse = COALESCE(_payload->>'adresse', adresse),
    observations = COALESCE(_payload->>'observations', observations),
    depot_id = COALESCE(NULLIF(_payload->>'depot_id','')::uuid, depot_id)
  WHERE commande_id = _commande_id;

  IF _payload ? 'type_frais_transport' THEN
    DECLARE
      v_t text := NULLIF(btrim(COALESCE(_payload->>'type_frais_transport','')), '');
      v_m numeric := NULLIF(_payload->>'montant_frais_transport','')::numeric;
    BEGIN
      IF v_t IS NOT NULL AND v_t NOT IN ('livraison','expedition') THEN
        RAISE EXCEPTION 'Type de frais de transport invalide : %', v_t USING ERRCODE = 'P0001';
      END IF;
      IF v_t IS NOT NULL AND (v_m IS NULL OR v_m < 0) THEN
        RAISE EXCEPTION 'Montant de transport invalide' USING ERRCODE = 'P0001';
      END IF;
      UPDATE public.commandes SET
        type_frais_transport = v_t,
        montant_frais_transport = CASE WHEN v_t IS NULL THEN NULL ELSE v_m END
      WHERE commande_id = _commande_id;
    END;
  END IF;

  IF _payload ? 'lignes' THEN
    -- Quantités par produit avant modification (déjà sorties du stock si la commande est validée).
    SELECT COALESCE(jsonb_object_agg(produit_id, q), '{}'::jsonb) INTO v_avant
      FROM (SELECT produit_id, sum(quantite) AS q FROM public.commande_lignes
             WHERE commande_id = _commande_id AND produit_id IS NOT NULL GROUP BY produit_id) s;

    DELETE FROM public.commande_lignes WHERE commande_id = _commande_id;
    DECLARE
      v_ligne jsonb;
      v_tva numeric; v_remise_g numeric;
      v_total_ht_brut numeric := 0; v_total_remises numeric := 0;
      v_total_ht_net numeric; v_remise_g_mnt numeric; v_tva_mnt numeric; v_ttc numeric;
      v_nb int := 0; v_qte int := 0;
      v_qte_l numeric; v_pu numeric; v_rpct numeric; v_rmnt numeric; v_tot numeric;
    BEGIN
      SELECT taux_tva, remise_globale_pct INTO v_tva, v_remise_g FROM public.commandes WHERE commande_id = _commande_id;
      v_tva := COALESCE((_payload->>'taux_tva')::numeric, v_tva);
      v_remise_g := COALESCE((_payload->>'remise_globale_pct')::numeric, v_remise_g);
      IF v_remise_g < 0 OR v_remise_g > 100 THEN RAISE EXCEPTION 'Remise globale hors de 0 à 100 %% (%)', v_remise_g USING ERRCODE = 'P0001'; END IF;
      IF v_tva < 0 OR v_tva > 100 THEN RAISE EXCEPTION 'Taux de TVA hors de 0 à 100 %% (%)', v_tva USING ERRCODE = 'P0001'; END IF;
      FOR v_ligne IN SELECT * FROM jsonb_array_elements(_payload->'lignes') LOOP
        v_qte_l := COALESCE((v_ligne->>'quantite')::numeric, 0);
        v_pu    := COALESCE((v_ligne->>'prix_unitaire')::numeric, 0);
        v_rpct  := COALESCE((v_ligne->>'remise_pct')::numeric, 0);
        IF v_qte_l <= 0 THEN RAISE EXCEPTION 'Quantité invalide (%) : elle doit être supérieure à 0', v_qte_l USING ERRCODE = 'P0001'; END IF;
        IF v_qte_l <> trunc(v_qte_l) THEN RAISE EXCEPTION 'Quantité non entière (%) refusée', v_qte_l USING ERRCODE = 'P0001'; END IF;
        IF v_pu < 0 THEN RAISE EXCEPTION 'Prix unitaire négatif refusé (%)', v_pu USING ERRCODE = 'P0001'; END IF;
        IF v_rpct < 0 OR v_rpct > 100 THEN RAISE EXCEPTION 'Remise de ligne hors de 0 à 100 %% (%)', v_rpct USING ERRCODE = 'P0001'; END IF;
        v_rmnt  := ROUND(v_qte_l * v_pu * v_rpct / 100, 2);
        v_tot   := ROUND(v_qte_l * v_pu - v_rmnt, 2);
        INSERT INTO public.commande_lignes(commande_id, produit_id, reference_produit, designation, quantite, prix_unitaire, remise_pct, montant_remise, total_ligne, total_ht_ligne)
        VALUES (_commande_id, NULLIF(v_ligne->>'produit_id','')::uuid, v_ligne->>'reference_produit',
                COALESCE(v_ligne->>'designation',''), v_qte_l, v_pu, v_rpct, v_rmnt, v_tot, v_tot);
        v_total_ht_brut := v_total_ht_brut + v_qte_l * v_pu;
        v_total_remises := v_total_remises + v_rmnt;
        v_nb := v_nb + 1; v_qte := v_qte + v_qte_l::int;
      END LOOP;
      v_total_ht_net := v_total_ht_brut - v_total_remises;
      v_remise_g_mnt := ROUND(v_total_ht_net * v_remise_g / 100, 2);
      v_total_ht_net := v_total_ht_net - v_remise_g_mnt;
      v_tva_mnt := ROUND(v_total_ht_net * v_tva / 100, 2);
      v_ttc := v_total_ht_net + v_tva_mnt;
      UPDATE public.commandes SET
        taux_tva = v_tva, remise_globale_pct = v_remise_g,
        nb_produits = v_nb, total_quantite = v_qte,
        total_ht_brut = v_total_ht_brut, total_remises_lignes = v_total_remises,
        total_ht_net = v_total_ht_net, remise_globale_montant = v_remise_g_mnt,
        montant_tva = v_tva_mnt, montant_ttc = v_ttc,
        net_a_payer = v_ttc, montant_total = v_ttc
      WHERE commande_id = _commande_id;
    END;

    -- Commande validée : le stock suit l'écart de quantité par produit.
    IF v_validee THEN
      SELECT COALESCE(jsonb_object_agg(produit_id, q), '{}'::jsonb) INTO v_apres
        FROM (SELECT produit_id, sum(quantite) AS q FROM public.commande_lignes
               WHERE commande_id = _commande_id AND produit_id IS NOT NULL GROUP BY produit_id) s;
      v_depot := v_cmd.depot_id;
      IF v_depot IS NULL THEN SELECT depot_id INTO v_depot FROM public.depots WHERE is_principal = true LIMIT 1; END IF;
      IF v_depot IS NULL THEN RAISE EXCEPTION 'Aucun dépôt défini pour ajuster le stock'; END IF;

      FOR r IN
        SELECT k::uuid AS produit_id,
               COALESCE((v_apres->>k)::numeric, 0) - COALESCE((v_avant->>k)::numeric, 0) AS delta
          FROM (SELECT jsonb_object_keys(v_avant) AS k UNION SELECT jsonb_object_keys(v_apres)) ks
         ORDER BY 1
      LOOP
        v_delta := r.delta;
        CONTINUE WHEN v_delta = 0;
        IF v_delta > 0 THEN
          SELECT quantite INTO v_dispo FROM public.stocks_depots
           WHERE produit_id = r.produit_id AND depot_id = v_depot FOR UPDATE;
          IF COALESCE(v_dispo, 0) < v_delta THEN
            RAISE EXCEPTION 'Stock insuffisant pour %: disponible %, supplément demandé %',
              (SELECT designation FROM public.produits WHERE produit_id = r.produit_id), COALESCE(v_dispo, 0), v_delta
              USING ERRCODE = 'P0001';
          END IF;
          UPDATE public.stocks_depots SET quantite = quantite - v_delta, updated_at = now()
           WHERE produit_id = r.produit_id AND depot_id = v_depot
          RETURNING quantite INTO v_new_stock;
        ELSE
          INSERT INTO public.stocks_depots(produit_id, depot_id, quantite) VALUES (r.produit_id, v_depot, -v_delta)
            ON CONFLICT (produit_id, depot_id) DO UPDATE
            SET quantite = public.stocks_depots.quantite + EXCLUDED.quantite, updated_at = now()
          RETURNING quantite INTO v_new_stock;
        END IF;
        INSERT INTO public.stock_mouvements(
          produit_id, depot_id, type, quantite, quantite_entree, quantite_sortie, stock_resultant,
          origine, document_id, document_reference, document_table, user_id, motif
        ) VALUES (
          r.produit_id, v_depot, CASE WHEN v_delta > 0 THEN 'sortie' ELSE 'entree' END, abs(v_delta),
          GREATEST(-v_delta, 0), GREATEST(v_delta, 0), v_new_stock,
          'modification_commande', _commande_id, v_cmd.reference, 'commandes', auth.uid(),
          'Modification commande ' || COALESCE(v_cmd.reference, '')
        );
      END LOOP;
    END IF;
  END IF;

  -- Facture liée (non annulée) : total recalculé, montant payé inchangé.
  IF _payload ? 'type_frais_transport' OR _payload ? 'lignes' THEN
    DECLARE
      v_fac_id uuid; v_client uuid; v_total numeric; v_paye numeric;
    BEGIN
      SELECT f.facture_id, f.client_id, COALESCE(f.montant_paye,0) INTO v_fac_id, v_client, v_paye
        FROM public.factures f
       WHERE f.commande_id = _commande_id AND COALESCE(f.statut, '') NOT IN ('annule', 'annulee')
       ORDER BY f.created_at DESC LIMIT 1
       FOR UPDATE;
      IF v_fac_id IS NOT NULL THEN
        SELECT COALESCE(c.net_a_payer,0) + COALESCE(c.montant_frais_transport,0) INTO v_total
          FROM public.commandes c WHERE c.commande_id = _commande_id;
        IF v_total + 0.01 < v_paye THEN
          RAISE EXCEPTION 'Nouveau total (% FCFA) inférieur au montant déjà payé (% FCFA)', v_total, v_paye USING ERRCODE = 'P0001';
        END IF;
        UPDATE public.factures f SET
          type_frais_transport = c.type_frais_transport,
          montant_frais_transport = c.montant_frais_transport,
          montant_total = v_total,
          statut = CASE WHEN v_paye <= 0 THEN 'impayee' WHEN v_paye >= v_total THEN 'payee' ELSE 'partielle' END
        FROM public.commandes c
        WHERE f.facture_id = v_fac_id AND c.commande_id = _commande_id;
        IF v_client IS NOT NULL THEN PERFORM public._recalc_solde_client_internal(v_client); END IF;
      END IF;
    END;
  END IF;

  RETURN QUERY SELECT * FROM public.commandes WHERE commande_id = _commande_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.annuler_commande(_commande_id uuid, _motif text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cmd public.commandes; v_depot uuid; r record; v_new_stock numeric;
BEGIN
  PERFORM public.assert_permission('commandes.annuler');
  SELECT * INTO v_cmd FROM public.commandes WHERE commande_id = _commande_id FOR UPDATE;
  IF v_cmd.commande_id IS NULL THEN RAISE EXCEPTION 'Commande introuvable'; END IF;
  IF v_cmd.statut = 'annulee' THEN RAISE EXCEPTION 'Commande déjà annulée'; END IF;

  IF EXISTS (SELECT 1 FROM public.paiements p JOIN public.factures f ON f.facture_id = p.facture_id
              WHERE f.commande_id = _commande_id AND COALESCE(p.statut, '') NOT IN ('annule', 'annulee', 'rejete')) THEN
    RAISE EXCEPTION 'Impossible d''annuler : des paiements existent. Annuler d''abord les paiements.' USING ERRCODE = 'P0001';
  END IF;
  IF public._commande_marchandise_partie(_commande_id) THEN
    RAISE EXCEPTION 'Annulation refusée : la marchandise est partie. Faites un retour.' USING ERRCODE = 'P0001';
  END IF;
  IF public._commande_facture_dgi(_commande_id) THEN
    RAISE EXCEPTION 'Annulation refusée : la facture est déclarée à la DGI. Faites un avoir.' USING ERRCODE = 'P0001';
  END IF;

  -- Commande validée (quel que soit le statut atteint depuis) : stock remis, facture et BL annulés.
  IF NOT public._commande_avant_validation(v_cmd.statut) THEN
    v_depot := v_cmd.depot_id;
    IF v_depot IS NULL THEN SELECT depot_id INTO v_depot FROM public.depots WHERE is_principal = true LIMIT 1; END IF;
    IF v_depot IS NULL THEN RAISE EXCEPTION 'Aucun dépôt défini pour remettre le stock'; END IF;
    FOR r IN SELECT cl.produit_id, sum(cl.quantite) AS quantite FROM public.commande_lignes cl
              WHERE cl.commande_id = _commande_id AND cl.produit_id IS NOT NULL
              GROUP BY cl.produit_id ORDER BY cl.produit_id LOOP
      INSERT INTO public.stocks_depots(produit_id, depot_id, quantite) VALUES (r.produit_id, v_depot, r.quantite)
        ON CONFLICT (produit_id, depot_id) DO UPDATE SET quantite = public.stocks_depots.quantite + EXCLUDED.quantite, updated_at = now()
      RETURNING quantite INTO v_new_stock;
      INSERT INTO public.stock_mouvements(produit_id, depot_id, type, quantite, quantite_entree, quantite_sortie, stock_resultant, origine, document_id, document_reference, document_table, user_id, motif)
      VALUES (r.produit_id, v_depot, 'entree', r.quantite, r.quantite, 0, v_new_stock, 'annulation_commande', _commande_id, v_cmd.reference, 'commandes', auth.uid(), COALESCE(_motif, 'Annulation commande'));
    END LOOP;
    UPDATE public.factures SET statut = 'annulee' WHERE commande_id = _commande_id AND COALESCE(statut, '') NOT IN ('annule', 'annulee');
    UPDATE public.bons_livraison SET statut = 'annulee' WHERE commande_id = _commande_id AND COALESCE(statut, '') NOT IN ('annule', 'annulee');
  END IF;

  DELETE FROM public.colis
    WHERE bl_id IN (SELECT bl_id FROM public.bons_livraison WHERE commande_id = _commande_id)
       OR commande_id = _commande_id;

  UPDATE public.proformas SET statut = 'annulee', updated_at = now()
    WHERE commande_id = _commande_id AND statut NOT IN ('acceptee', 'annulee');

  BEGIN
    UPDATE public.notifications SET lue = true, updated_at = now()
      WHERE document_id = _commande_id::text AND COALESCE(lue, false) = false;
  EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END;

  UPDATE public.commandes SET statut = 'annulee', notes = COALESCE(_motif, notes) WHERE commande_id = _commande_id;
  PERFORM public._recalc_solde_client_internal(v_cmd.client_id);
END; $function$;

-- Suppression : droit commandes.supprimer (brouillon : créer suffit), suppression forcée
-- réservée au super administrateur, refus si la marchandise est partie.
DO $$
DECLARE d text; o text;
  v_ancre text := $x$  v_is_admin := public.has_role(auth.uid(),'super_admin');
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Permission refusée' USING ERRCODE='42501';
  END IF;$x$;
  v_garde text := $x$  v_is_admin := public.has_role(auth.uid(),'super_admin');
  SELECT statut INTO v_statut_droit FROM public.commandes WHERE commande_id=_commande_id;
  PERFORM public._commande_assert_droit(v_statut_droit, 'commandes.supprimer');
  IF _force AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Suppression forcée réservée au super administrateur' USING ERRCODE='42501';
  END IF;
  IF NOT _force AND public._commande_marchandise_partie(_commande_id) THEN
    RAISE EXCEPTION 'Suppression refusée : la marchandise est partie.' USING ERRCODE='P0001';
  END IF;$x$;
BEGIN
  d := pg_get_functiondef('public.supprimer_commande_definitif(uuid,text,boolean)'::regprocedure); o := d;
  IF position('_commande_assert_droit' in d) > 0 THEN RETURN; END IF; -- déjà appliquée
  d := replace(d, v_ancre, v_garde);
  d := replace(d, '  v_is_admin boolean;', '  v_is_admin boolean; v_statut_droit text;');
  IF d = o OR position('_commande_assert_droit' in d) = 0 OR position('v_statut_droit text;' in d) = 0 THEN
    RAISE EXCEPTION 'supprimer_commande_definitif : remplacement impossible (ancre introuvable)';
  END IF;
  EXECUTE d;
END $$;

-- Fonctions anciennes : plus appelables depuis l'application (toutes signatures).
DO $$
DECLARE p regprocedure;
BEGIN
  FOR p IN SELECT oid::regprocedure FROM pg_proc
            WHERE pronamespace = 'public'::regnamespace AND proname IN ('creer_retour', 'convertir_commande_en_bl') LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM public, anon, authenticated', p);
  END LOOP;
END $$;
