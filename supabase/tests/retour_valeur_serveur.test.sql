-- Validation comptable d'un retour (migration 0092). À lancer avec un rôle ayant
-- retours.valider_compta ; tout est annulé en fin de script.
-- psql -v ON_ERROR_STOP=1 -f supabase/tests/retour_valeur_serveur.test.sql
BEGIN;

DO $$
DECLARE v_r public.retours; v_valeur numeric; v_avoir public.factures;
BEGIN
  SELECT r.* INTO v_r FROM public.retours r
   WHERE r.statut = 'attente_validation_compta' AND r.client_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.retour_lignes rl WHERE rl.retour_id = r.retour_id AND rl.total_ligne > 0)
   LIMIT 1;
  IF v_r.retour_id IS NULL THEN RAISE NOTICE 'aucun retour en attente de validation, test ignoré'; RETURN; END IF;
  v_valeur := public._retour_valeur(v_r.retour_id);

  -- Comme l'écran : aucun montant envoyé ; un montant falsifié serait ignoré lui aussi.
  PERFORM public.retour_valider_compta(v_r.retour_id, v_r.version_no, 'creer_avoir',
    jsonb_build_object('valeur_retour', 1), 'test');

  SELECT * INTO v_r FROM public.retours WHERE retour_id = v_r.retour_id;
  ASSERT v_r.montant = v_valeur AND v_valeur > 0, 'valeur du retour non reprise des lignes';
  SELECT * INTO v_avoir FROM public.factures WHERE facture_id = v_r.avoir_facture_id;
  ASSERT v_avoir.montant_total = -v_valeur, 'montant de l''avoir différent de la valeur du retour';
  ASSERT v_avoir.reference ~ '^AV-[0-9]{4}-[0-9]{5}$', 'avoir non numéroté par _next_ref : ' || v_avoir.reference;
  RAISE NOTICE 'OK retour % : % FCFA, avoir %', v_r.reference, v_valeur, v_avoir.reference;
END $$;

ROLLBACK;
