CREATE OR REPLACE FUNCTION public._retour_encours_lock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Réessayez le retour dans une nouvelle transaction' USING ERRCODE='40001';
  END IF;
  PERFORM pg_advisory_xact_lock(19271110, 122);
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public._retour_encours_lock() FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public._retour_encours_actif(_statut text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
 SELECT lower(COALESCE(_statut,'')) NOT IN
 ('annule','annulee','rejete','refuse','refus_magasin','refus_compta','refuse_magasin','refuse_compta');
$$;
REVOKE ALL ON FUNCTION public._retour_encours_actif(text) FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public._retour_encours_comptabilise(_statut text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
 SELECT lower(COALESCE(_statut,'')) IN ('valide','accepte','valide_compta','cloture');
$$;
REVOKE ALL ON FUNCTION public._retour_encours_comptabilise(text) FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public._retour_encours_montant(_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT GREATEST(COALESCE(r.montant,0),COALESCE(public._retour_valeur(r.retour_id),0),0)
 FROM public.retours r WHERE r.retour_id=_id;
$$;
REVOKE ALL ON FUNCTION public._retour_encours_montant(uuid) FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public._retour_encours_etat(_client uuid, _exclure uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 WITH montants AS (
 SELECT public.solde_client_calcule(_client) AS solde,
 COALESCE((SELECT sum(public._retour_encours_montant(r.retour_id)) FROM public.retours r
 WHERE r.client_id=_client AND r.retour_id IS DISTINCT FROM _exclure
 AND public._retour_encours_actif(r.statut) AND NOT public._retour_encours_comptabilise(r.statut)),0) AS reserve)
 SELECT jsonb_build_object('solde',solde,'reserve',reserve,'disponible',GREATEST(solde-reserve,0)) FROM montants;
$$;
REVOKE ALL ON FUNCTION public._retour_encours_etat(uuid,uuid) FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.retour_encours_disponible(_client_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 PERFORM public.assert_permission('retours.creer');
 IF NOT EXISTS (SELECT 1 FROM public.clients WHERE client_id=_client_id) THEN
   RAISE EXCEPTION 'Client introuvable';
 END IF;
 RETURN public._retour_encours_etat(_client_id);
END $$;
REVOKE ALL ON FUNCTION public.retour_encours_disponible(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retour_encours_disponible(uuid) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public._retour_encours_assert(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.retours; v_solde numeric; v_reserve numeric; v_montant numeric; v_dispo numeric;
BEGIN
 SELECT * INTO r FROM public.retours WHERE retour_id=_id;
 IF NOT FOUND OR NOT public._retour_encours_actif(r.statut) THEN RETURN; END IF;
 IF r.client_id IS NULL THEN RAISE EXCEPTION 'Le client est obligatoire'; END IF;
 v_montant := public._retour_encours_montant(_id);
 v_solde := public.solde_client_calcule(r.client_id);
 IF public._retour_encours_comptabilise(r.statut) THEN
   v_solde := v_solde + COALESCE(r.montant,0);
 END IF;
 SELECT COALESCE(sum(public._retour_encours_montant(r2.retour_id)),0) INTO v_reserve
 FROM public.retours r2 WHERE r2.client_id=r.client_id AND r2.retour_id<>_id
 AND public._retour_encours_actif(r2.statut) AND NOT public._retour_encours_comptabilise(r2.statut);
 v_dispo := GREATEST(v_solde-v_reserve,0);
 IF v_solde <= 0 THEN
   RAISE EXCEPTION 'Retour impossible : ce client ne présente aucun encours débiteur. Les retours sont autorisés uniquement dans la limite de sa dette actuelle.';
 END IF;
 IF COALESCE(r.montant,0)<0 OR COALESCE(public._retour_valeur(_id),0)<0 THEN
   RAISE EXCEPTION 'Montant de retour invalide';
 END IF;
 IF v_montant > v_dispo THEN
   RAISE EXCEPTION 'Retour impossible : le montant du retour dépasse l''encours disponible du client. Encours disponible : %. Montant du retour : %.',
     public._fmt_fcfa(v_dispo::text),public._fmt_fcfa(v_montant::text);
 END IF;
END $$;
REVOKE ALL ON FUNCTION public._retour_encours_assert(uuid) FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public._retour_encours_check()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF TG_OP <> 'INSERT' THEN PERFORM public._retour_encours_assert(OLD.retour_id); END IF;
 IF TG_OP <> 'DELETE' THEN PERFORM public._retour_encours_assert(NEW.retour_id); END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public._retour_encours_check() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER retour_encours_lock BEFORE INSERT OR UPDATE OR DELETE ON public.retours
FOR EACH STATEMENT EXECUTE FUNCTION public._retour_encours_lock();
CREATE TRIGGER retour_lignes_encours_lock BEFORE INSERT OR UPDATE OR DELETE ON public.retour_lignes
FOR EACH STATEMENT EXECUTE FUNCTION public._retour_encours_lock();
CREATE TRIGGER factures_encours_lock BEFORE INSERT OR UPDATE OR DELETE ON public.factures
FOR EACH STATEMENT EXECUTE FUNCTION public._retour_encours_lock();
CREATE TRIGGER paiements_encours_lock BEFORE INSERT OR UPDATE OR DELETE ON public.paiements
FOR EACH STATEMENT EXECUTE FUNCTION public._retour_encours_lock();
CREATE TRIGGER allocations_encours_lock BEFORE INSERT OR UPDATE OR DELETE ON public.payment_allocations
FOR EACH STATEMENT EXECUTE FUNCTION public._retour_encours_lock();
CREATE CONSTRAINT TRIGGER retour_encours_check AFTER INSERT OR UPDATE OF client_id, statut, montant, remise_globale_pct ON public.retours
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public._retour_encours_check();
CREATE CONSTRAINT TRIGGER retour_lignes_encours_check AFTER INSERT OR UPDATE OR DELETE ON public.retour_lignes
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public._retour_encours_check();
DO $patch$
DECLARE v_oid oid; v_def text; v_name text;
BEGIN
 FOR v_oid,v_name IN SELECT p.oid,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.prolang=(SELECT oid FROM pg_language WHERE lanname='plpgsql')
 AND p.proname IN ('creer_retour','retour_creer_demande','retour_creer_et_valider',
 '_retour_traiter_auto','_retour_receptionner_core','retour_receptionner',
 '_retour_valider_compta_core','retour_valider_compta','retour_forcer_cloture',
 'annuler_retour','supprimer_retour_definitif','retour_refuser_magasin','retour_refuser_compta',
 'valider_paiement','annuler_paiement')
 LOOP
  v_def := pg_get_functiondef(v_oid);
  v_def := regexp_replace(v_def,'\mBEGIN\M',E'BEGIN\n  PERFORM pg_advisory_xact_lock(19271110, 122);','i');
  IF v_name='_retour_valider_compta_core' THEN
    IF position('UPDATE public.clients SET solde=COALESCE(solde,0)-v_valeur' in v_def)=0 THEN
      RAISE EXCEPTION 'Validation comptable modifiée : réexaminer avant migration';
    END IF;
    v_def := replace(v_def, E'    UPDATE public.clients SET solde=COALESCE(solde,0)-v_valeur, updated_at=now()\n    WHERE client_id=v_retour.client_id;',
      '    -- The status trigger recalculates the balance using solde_client_calcule.');
  END IF;
  EXECUTE v_def;
 END LOOP;
END $patch$;