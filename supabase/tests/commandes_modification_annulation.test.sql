-- Commandes : modification après validation, annulation, fonctions anciennes (migration 0115).
-- À lancer avec un rôle ayant commandes.modifier et commandes.annuler ; tout est annulé en fin de script.
-- psql -v ON_ERROR_STOP=1 -f supabase/tests/commandes_modification_annulation.test.sql
BEGIN;

DO $$
BEGIN
  -- Anciennes fonctions : plus appelables depuis l'application.
  ASSERT NOT has_function_privilege('authenticated', 'public.creer_retour(jsonb)', 'EXECUTE'),
    'creer_retour encore appelable';
  ASSERT NOT EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace
                      AND proname = 'convertir_commande_en_bl'
                      AND has_function_privilege('authenticated', oid, 'EXECUTE')),
    'convertir_commande_en_bl encore appelable';
  RAISE NOTICE 'OK fonctions anciennes';
END $$;

DO $$
DECLARE v_c uuid; ok boolean;
BEGIN
  -- Marchandise partie : ni modification ni annulation.
  SELECT l.commande_id INTO v_c FROM public.livsuivi_commandes l
    JOIN public.commandes c ON c.commande_id = l.commande_id
   WHERE l.statut::text <> 'preparee' AND c.statut <> 'annulee' LIMIT 1;
  IF v_c IS NULL THEN RAISE NOTICE 'aucune commande partie en livraison, test ignoré'; RETURN; END IF;
  BEGIN
    PERFORM public.annuler_commande(v_c, 'test');
    ok := false;
  EXCEPTION WHEN others THEN ok := SQLERRM LIKE '%marchandise est partie%' OR SQLERRM LIKE '%paiements existent%';
  END;
  ASSERT ok, 'commande partie en livraison annulée';
  BEGIN
    PERFORM public.modifier_commande(v_c, jsonb_build_object('observations', 'test'));
    ok := false;
  EXCEPTION WHEN others THEN ok := SQLERRM LIKE '%marchandise est partie%' OR SQLERRM LIKE '%DGI%';
  END;
  ASSERT ok, 'commande partie en livraison modifiée';
  RAISE NOTICE 'OK marchandise partie';
END $$;

DO $$
DECLARE v_c uuid; v_depot uuid; v_prod uuid; v_stock numeric; v_total numeric; v_lignes jsonb;
BEGIN
  -- Commande validée, non partie, sans paiement ni facture DGI : +1 sur la première ligne.
  SELECT c.commande_id, COALESCE(c.depot_id, (SELECT depot_id FROM public.depots WHERE is_principal LIMIT 1))
    INTO v_c, v_depot
    FROM public.commandes c
   WHERE NOT public._commande_avant_validation(c.statut) AND c.statut <> 'annulee'
     AND NOT public._commande_marchandise_partie(c.commande_id)
     AND NOT public._commande_facture_dgi(c.commande_id)
     AND EXISTS (SELECT 1 FROM public.commande_lignes cl WHERE cl.commande_id = c.commande_id AND cl.produit_id IS NOT NULL)
   LIMIT 1;
  IF v_c IS NULL THEN RAISE NOTICE 'aucune commande validée modifiable, test ignoré'; RETURN; END IF;

  SELECT cl.produit_id INTO v_prod FROM public.commande_lignes cl
   WHERE cl.commande_id = v_c AND cl.produit_id IS NOT NULL ORDER BY cl.created_at LIMIT 1;
  INSERT INTO public.stocks_depots(produit_id, depot_id, quantite) VALUES (v_prod, v_depot, 10)
    ON CONFLICT (produit_id, depot_id) DO UPDATE SET quantite = public.stocks_depots.quantite + 10;
  SELECT quantite INTO v_stock FROM public.stocks_depots WHERE produit_id = v_prod AND depot_id = v_depot;

  SELECT jsonb_agg(jsonb_build_object(
           'produit_id', cl.produit_id, 'reference_produit', cl.reference_produit, 'designation', cl.designation,
           'quantite', cl.quantite + CASE WHEN cl.ligne_id = first.ligne_id THEN 1 ELSE 0 END,
           'prix_unitaire', cl.prix_unitaire, 'remise_pct', cl.remise_pct) ORDER BY cl.created_at)
    INTO v_lignes
    FROM public.commande_lignes cl,
         LATERAL (SELECT ligne_id FROM public.commande_lignes x
                   WHERE x.commande_id = v_c AND x.produit_id = v_prod ORDER BY x.created_at LIMIT 1) first
   WHERE cl.commande_id = v_c;

  PERFORM public.modifier_commande(v_c, jsonb_build_object('lignes', v_lignes));

  ASSERT (SELECT quantite FROM public.stocks_depots WHERE produit_id = v_prod AND depot_id = v_depot) = v_stock - 1,
    'stock non ajusté après modification';
  SELECT COALESCE(net_a_payer, 0) + COALESCE(montant_frais_transport, 0) INTO v_total FROM public.commandes WHERE commande_id = v_c;
  ASSERT NOT EXISTS (SELECT 1 FROM public.factures WHERE commande_id = v_c
                      AND COALESCE(statut, '') NOT IN ('annule', 'annulee') AND montant_total <> v_total),
    'facture non recalculée';
  RAISE NOTICE 'OK modification après validation';

  -- Annulation de cette commande (sans paiement) : stock remis, facture annulée.
  IF EXISTS (SELECT 1 FROM public.paiements p JOIN public.factures f ON f.facture_id = p.facture_id
              WHERE f.commande_id = v_c AND COALESCE(p.statut, '') NOT IN ('annule', 'annulee', 'rejete')) THEN
    RAISE NOTICE 'commande avec paiement, test d''annulation ignoré'; RETURN;
  END IF;
  SELECT quantite INTO v_stock FROM public.stocks_depots WHERE produit_id = v_prod AND depot_id = v_depot;
  PERFORM public.annuler_commande(v_c, 'test');
  ASSERT (SELECT quantite FROM public.stocks_depots WHERE produit_id = v_prod AND depot_id = v_depot)
         = v_stock + (SELECT sum(quantite) FROM public.commande_lignes WHERE commande_id = v_c AND produit_id = v_prod),
    'stock non remis à l''annulation';
  ASSERT NOT EXISTS (SELECT 1 FROM public.factures WHERE commande_id = v_c AND COALESCE(statut, '') NOT IN ('annule', 'annulee')),
    'facture restée ouverte après annulation';
  RAISE NOTICE 'OK annulation';
END $$;

ROLLBACK;
