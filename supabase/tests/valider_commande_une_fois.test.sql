-- valider_commande : une seule validation par commande (migration 0093).
-- À lancer avec un rôle ayant commandes.valider ; tout est annulé en fin de script.
-- psql -v ON_ERROR_STOP=1 -f supabase/tests/valider_commande_une_fois.test.sql
BEGIN;

DO $$
DECLARE v_c uuid; v_nb_fac int; v_nb_mvt int; ok boolean;
BEGIN
  -- Commande déjà validée puis passée en livraison : une nouvelle validation est refusée.
  SELECT c.commande_id INTO v_c FROM public.commandes c
   WHERE c.statut IN ('livraison_en_cours', 'livree', 'remise_livreur', 'depart_depot', 'arrive_client')
   LIMIT 1;
  IF v_c IS NULL THEN RAISE NOTICE 'aucune commande livrée, test ignoré'; RETURN; END IF;

  SELECT count(*) INTO v_nb_fac FROM public.factures WHERE commande_id = v_c;
  SELECT count(*) INTO v_nb_mvt FROM public.stock_mouvements WHERE document_id = v_c AND origine = 'vente';
  BEGIN
    PERFORM public.valider_commande(v_c);
    ok := false;
  EXCEPTION WHEN others THEN ok := SQLERRM LIKE 'Commande déjà traitée%' OR SQLERRM LIKE '%déjà une facture%';
  END;
  ASSERT ok, 'commande livrée validée une deuxième fois';
  ASSERT (SELECT count(*) FROM public.factures WHERE commande_id = v_c) = v_nb_fac, 'facture en double';
  ASSERT (SELECT count(*) FROM public.stock_mouvements WHERE document_id = v_c AND origine = 'vente') = v_nb_mvt,
    'stock sorti deux fois';
  RAISE NOTICE 'OK statut';
END $$;

DO $$
DECLARE v_c uuid; ok boolean;
BEGIN
  -- Commande remise en attente alors qu'elle a déjà une facture : refusée aussi.
  SELECT f.commande_id INTO v_c FROM public.factures f
   WHERE f.commande_id IS NOT NULL AND COALESCE(f.statut, '') NOT IN ('annule', 'annulee') LIMIT 1;
  IF v_c IS NULL THEN RAISE NOTICE 'aucune commande facturée, test ignoré'; RETURN; END IF;
  UPDATE public.commandes SET statut = 'en_attente_validation' WHERE commande_id = v_c;
  BEGIN
    PERFORM public.valider_commande(v_c);
    ok := false;
  EXCEPTION WHEN others THEN ok := SQLERRM LIKE '%déjà une facture%';
  END;
  ASSERT ok, 'deuxième facture créée pour la même commande';
  RAISE NOTICE 'OK facture existante';
END $$;

ROLLBACK;
