-- Anti-surpaiement (migration 0092). Tout est annulé en fin de script.
-- psql -v ON_ERROR_STOP=1 -f supabase/tests/anti_surpaiement.test.sql
BEGIN;

DO $$
DECLARE v_f uuid; v_reste numeric; v_p1 uuid; v_p2 uuid; ok boolean;
BEGIN
  SELECT facture_id, montant_total - public.facture_engage(facture_id) INTO v_f, v_reste
    FROM public.factures
   WHERE statut IN ('impayee','partielle') AND montant_total > 0
     AND montant_total - public.facture_engage(facture_id) >= 10
   LIMIT 1;
  IF v_f IS NULL THEN RAISE NOTICE 'aucune facture ouverte, test ignoré'; RETURN; END IF;

  -- 1. Premier paiement en attente pour tout le reste : accepté.
  INSERT INTO public.paiements(paiement_id, montant, statut, date_paiement)
  VALUES (gen_random_uuid(), v_reste, 'en_attente_validation', current_date) RETURNING paiement_id INTO v_p1;
  INSERT INTO public.payment_allocations(paiement_id, facture_id, montant) VALUES (v_p1, v_f, v_reste);

  -- 2. Second paiement en attente sur la même facture : refusé (l'engagé compte le premier).
  INSERT INTO public.paiements(paiement_id, montant, statut, date_paiement)
  VALUES (gen_random_uuid(), 1, 'en_attente_validation', current_date) RETURNING paiement_id INTO v_p2;
  BEGIN
    INSERT INTO public.payment_allocations(paiement_id, facture_id, montant) VALUES (v_p2, v_f, 1);
    ok := false;
  EXCEPTION WHEN others THEN ok := SQLERRM LIKE 'Montant supérieur au reste à payer%';
  END;
  ASSERT ok, 'second paiement en attente accepté au-delà du total';

  -- 3. Un paiement rejeté libère l'engagé.
  UPDATE public.paiements SET statut = 'rejete' WHERE paiement_id = v_p1;
  INSERT INTO public.payment_allocations(paiement_id, facture_id, montant) VALUES (v_p2, v_f, 1);
  RAISE NOTICE 'OK affectations';
END $$;

-- 4. Doublon déjà en attente (créé avant la migration) : la validation du second est refusée.
DO $$
DECLARE v_f uuid; v_reste numeric; v_p1 uuid; v_p2 uuid; ok boolean;
BEGIN
  SELECT facture_id, montant_total - public.facture_engage(facture_id) INTO v_f, v_reste
    FROM public.factures
   WHERE statut IN ('impayee','partielle') AND montant_total > 0
     AND montant_total - public.facture_engage(facture_id) >= 10
   LIMIT 1;
  IF v_f IS NULL THEN RAISE NOTICE 'aucune facture ouverte, test ignoré'; RETURN; END IF;

  ALTER TABLE public.payment_allocations DISABLE TRIGGER trg_allocation_anti_surpaiement;
  INSERT INTO public.paiements(paiement_id, montant, statut, date_paiement)
  VALUES (gen_random_uuid(), v_reste, 'en_attente_validation', current_date) RETURNING paiement_id INTO v_p1;
  INSERT INTO public.payment_allocations(paiement_id, facture_id, montant) VALUES (v_p1, v_f, v_reste);
  INSERT INTO public.paiements(paiement_id, montant, statut, date_paiement)
  VALUES (gen_random_uuid(), v_reste, 'en_attente_validation', current_date) RETURNING paiement_id INTO v_p2;
  INSERT INTO public.payment_allocations(paiement_id, facture_id, montant) VALUES (v_p2, v_f, v_reste);
  ALTER TABLE public.payment_allocations ENABLE TRIGGER trg_allocation_anti_surpaiement;

  UPDATE public.paiements SET statut = 'valide' WHERE paiement_id = v_p1;
  BEGIN
    UPDATE public.paiements SET statut = 'valide' WHERE paiement_id = v_p2;
    ok := false;
  EXCEPTION WHEN others THEN ok := SQLERRM LIKE 'Validation refusée%';
  END;
  ASSERT ok, 'doublon validé : facture payée deux fois';
  RAISE NOTICE 'OK validation';
END $$;

ROLLBACK;
