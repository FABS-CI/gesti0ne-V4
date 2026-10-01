CREATE OR REPLACE FUNCTION public.modifier_commande(_commande_id uuid, _payload jsonb)
 RETURNS SETOF commandes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_statut text;
  v_is_super_admin boolean := public.has_role(auth.uid(), 'super_admin');
BEGIN
  SELECT statut INTO v_statut FROM public.commandes WHERE commande_id = _commande_id;
  IF v_statut IS NULL THEN RAISE EXCEPTION 'Commande introuvable'; END IF;
  IF NOT v_is_super_admin AND v_statut NOT IN ('brouillon', 'en_attente_validation', 'soumise') THEN
    RAISE EXCEPTION 'Modification non autorisée pour ce statut (%)', v_statut;
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
      FOR v_ligne IN SELECT * FROM jsonb_array_elements(_payload->'lignes') LOOP
        v_qte_l := COALESCE((v_ligne->>'quantite')::numeric, 0);
        v_pu    := COALESCE((v_ligne->>'prix_unitaire')::numeric, 0);
        v_rpct  := COALESCE((v_ligne->>'remise_pct')::numeric, 0);
        v_rmnt  := ROUND(v_qte_l * v_pu * v_rpct / 100, 2);
        v_tot   := ROUND(v_qte_l * v_pu - v_rmnt, 2);
        INSERT INTO public.commande_lignes(commande_id, produit_id, reference_produit, designation, quantite, prix_unitaire, remise_pct, montant_remise, total_ligne, total_ht_ligne)
        VALUES (_commande_id, NULLIF(v_ligne->>'produit_id','')::uuid, v_ligne->>'reference_produit',
                COALESCE(v_ligne->>'designation',''), v_qte_l::int, v_pu, v_rpct, v_rmnt, v_tot, v_tot);
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
  END IF;

  -- Synchronisation de la facture liée (frais de transport / total), montant payé inchangé
  IF _payload ? 'type_frais_transport' OR _payload ? 'lignes' THEN
    DECLARE
      v_fac_id uuid; v_client uuid; v_total numeric; v_paye numeric;
    BEGIN
      SELECT f.facture_id, f.client_id, COALESCE(f.montant_paye,0) INTO v_fac_id, v_client, v_paye
        FROM public.factures f WHERE f.commande_id = _commande_id LIMIT 1;
      IF v_fac_id IS NOT NULL THEN
        SELECT COALESCE(c.net_a_payer,0) + COALESCE(c.montant_frais_transport,0) INTO v_total
          FROM public.commandes c WHERE c.commande_id = _commande_id;
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