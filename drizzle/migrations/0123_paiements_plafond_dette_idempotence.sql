CREATE OR REPLACE FUNCTION public._paiement_dette_etat(_client uuid, _exclure uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
WITH e AS (SELECT public.solde_client_calcule(_client) solde,
 COALESCE((SELECT sum(a.montant) FROM public.payment_allocations a JOIN public.paiements p ON p.paiement_id=a.paiement_id JOIN public.factures f ON f.facture_id=a.facture_id
 WHERE f.client_id=_client AND p.statut IN ('en_attente','en_attente_validation') AND p.paiement_id IS DISTINCT FROM _exclure),0) reserve)
SELECT jsonb_build_object('solde',solde,'reserve',reserve,'disponible',GREATEST(solde-reserve,0)) FROM e;
$$;
REVOKE ALL ON FUNCTION public._paiement_dette_etat(uuid,uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.paiement_dette_disponible(_client_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM public.assert_permission('paiements.creer');
 IF NOT EXISTS(SELECT 1 FROM public.clients WHERE client_id=_client_id) THEN RAISE EXCEPTION 'Client introuvable'; END IF;
 RETURN public._paiement_dette_etat(_client_id);
END $$;
REVOKE ALL ON FUNCTION public.paiement_dette_disponible(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.paiement_dette_disponible(uuid) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public._paiement_dette_assert(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.paiements; v_client uuid; v_nb int; v_total numeric; v_solde numeric; v_reserve numeric; v_propre numeric; v_dispo numeric; r record;
BEGIN
 SELECT * INTO p FROM public.paiements WHERE paiement_id=_id;
 IF NOT FOUND OR p.statut NOT IN ('valide','en_attente','en_attente_validation') THEN RETURN; END IF;
 IF p.montant IS NULL OR p.montant<=0 OR p.montant::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Montant du paiement invalide'; END IF;
 IF NULLIF(btrim(p.idempotency_key),'') IS NULL THEN RAISE EXCEPTION 'Clé de soumission obligatoire'; END IF;
 SELECT count(DISTINCT f.client_id),sum(a.montant) INTO v_nb,v_total FROM public.payment_allocations a JOIN public.factures f ON f.facture_id=a.facture_id WHERE a.paiement_id=_id;
 SELECT f.client_id INTO v_client FROM public.payment_allocations a JOIN public.factures f ON f.facture_id=a.facture_id WHERE a.paiement_id=_id LIMIT 1;
 IF v_nb<>1 OR v_client IS NULL THEN RAISE EXCEPTION 'Toutes les factures doivent appartenir au même client'; END IF;
 IF v_total IS DISTINCT FROM p.montant THEN RAISE EXCEPTION 'Le montant reçu doit être entièrement affecté aux factures sélectionnées'; END IF;
 IF p.facture_id IS NOT NULL AND (SELECT count(*) FROM public.payment_allocations WHERE paiement_id=_id AND facture_id=p.facture_id)<>1 THEN RAISE EXCEPTION 'Facture du paiement incohérente'; END IF;
 v_solde:=public.solde_client_calcule(v_client);
 v_propre:=CASE WHEN p.statut='valide' THEN v_total ELSE 0 END;
 v_solde:=v_solde+v_propre;
 SELECT COALESCE(sum(a.montant),0) INTO v_reserve FROM public.payment_allocations a JOIN public.paiements p2 ON p2.paiement_id=a.paiement_id JOIN public.factures f ON f.facture_id=a.facture_id
 WHERE f.client_id=v_client AND p2.statut IN ('en_attente','en_attente_validation') AND p2.paiement_id<>_id;
 v_dispo:=GREATEST(v_solde-v_reserve,0);
 IF v_solde<=0 THEN RAISE EXCEPTION 'Paiement impossible : ce client ne présente aucun solde débiteur. Aucun paiement supplémentaire n''est autorisé.'; END IF;
 IF p.montant>v_dispo THEN RAISE EXCEPTION 'Paiement refusé : le montant saisi dépasse le solde restant dû. Montant dû : %. Paiement demandé : %.',public._fmt_fcfa(v_dispo::text),public._fmt_fcfa(p.montant::text); END IF;
 FOR r IN SELECT a.montant,f.facture_id,f.montant_total,f.statut FROM public.payment_allocations a JOIN public.factures f ON f.facture_id=a.facture_id WHERE a.paiement_id=_id LOOP
  IF r.montant<=0 OR r.montant::text IN ('NaN','Infinity','-Infinity') OR r.montant_total<0 OR lower(COALESCE(r.statut,'')) IN ('avoir','annule','annulee') THEN RAISE EXCEPTION 'Facture ou affectation invalide pour un paiement'; END IF;
  IF (SELECT COALESCE(sum(a.montant),0) FROM public.payment_allocations a JOIN public.paiements p2 ON p2.paiement_id=a.paiement_id WHERE a.facture_id=r.facture_id AND p2.statut IN ('valide','en_attente','en_attente_validation'))>r.montant_total THEN RAISE EXCEPTION 'Paiement refusé : le montant dépasse le reste dû de la facture'; END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public._paiement_dette_assert(uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public._paiement_dette_check()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN PERFORM public._paiement_dette_assert(OLD.paiement_id); END IF;
 IF TG_OP<>'DELETE' THEN PERFORM public._paiement_dette_assert(NEW.paiement_id); END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public._paiement_dette_check() FROM PUBLIC,anon,authenticated;
CREATE CONSTRAINT TRIGGER paiement_dette_check AFTER INSERT OR UPDATE OF montant,statut,facture_id,idempotency_key ON public.paiements DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public._paiement_dette_check();
CREATE CONSTRAINT TRIGGER paiement_allocations_dette_check AFTER INSERT OR UPDATE OR DELETE ON public.payment_allocations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public._paiement_dette_check();
CREATE OR REPLACE FUNCTION public._paiement_soumission_verifier(_payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.paiements; v_key text:=NULLIF(btrim(_payload->>'idempotency_key'),''); v_alloc jsonb; v_attendu jsonb; v_client uuid;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'Réessayez le paiement dans une nouvelle transaction' USING ERRCODE='40001'; END IF;
 PERFORM pg_advisory_xact_lock(19271110,122);
 PERFORM public.assert_permission('paiements.creer');
 IF v_key IS NULL THEN RAISE EXCEPTION 'Clé de soumission obligatoire'; END IF;
 SELECT * INTO p FROM public.paiements WHERE idempotency_key=v_key;
 IF NOT FOUND THEN RETURN; END IF;
 SELECT jsonb_agg(jsonb_build_object('facture_id',a.facture_id,'montant',a.montant) ORDER BY a.facture_id) INTO v_alloc FROM public.payment_allocations a WHERE a.paiement_id=p.paiement_id;
 SELECT f.client_id INTO v_client FROM public.payment_allocations a JOIN public.factures f ON f.facture_id=a.facture_id WHERE a.paiement_id=p.paiement_id LIMIT 1;
 IF _payload ? 'allocations' THEN
 SELECT jsonb_agg(jsonb_build_object('facture_id',(x->>'facture_id')::uuid,'montant',(x->>'montant')::numeric) ORDER BY (x->>'facture_id')::uuid) INTO v_attendu FROM jsonb_array_elements(_payload->'allocations') x;
 ELSE v_attendu:=jsonb_build_array(jsonb_build_object('facture_id',(_payload->>'facture_id')::uuid,'montant',(_payload->>'montant')::numeric)); END IF;
 IF p.cree_par IS DISTINCT FROM auth.uid() OR p.montant IS DISTINCT FROM (_payload->>'montant')::numeric OR v_alloc IS DISTINCT FROM v_attendu
 OR (NULLIF(_payload->>'client_id','') IS NOT NULL AND v_client IS DISTINCT FROM (_payload->>'client_id')::uuid)
 OR p.date_paiement IS DISTINCT FROM COALESCE((_payload->>'date_paiement')::date,current_date)
 OR p.mode_paiement IS DISTINCT FROM COALESCE(_payload->>'mode_paiement','especes')
 OR COALESCE(p.reference_paiement,'')<>COALESCE(_payload->>'reference_paiement','')
 OR COALESCE(p.banque,'')<>COALESCE(_payload->>'banque','') OR COALESCE(p.num_transaction,'')<>COALESCE(_payload->>'num_transaction','')
 OR COALESCE(p.observations,'')<>COALESCE(_payload->>'observations','') OR COALESCE(p.notes,'')<>COALESCE(_payload->>'notes','') THEN
 RAISE EXCEPTION 'Cette clé de soumission a déjà été utilisée pour un autre paiement'; END IF;
END $$;
REVOKE ALL ON FUNCTION public._paiement_soumission_verifier(jsonb) FROM PUBLIC,anon,authenticated;
DO $patch$
DECLARE v_oid oid; v_def text;
BEGIN
 FOR v_oid IN SELECT oid FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('enregistrer_paiement','enregistrer_paiement_multi') LOOP
 v_def:=pg_get_functiondef(v_oid);
 IF position('PERFORM public.allocate_payment_to_invoice_lines(v_alloc_id);' IN v_def)=0 THEN RAISE EXCEPTION 'Définition du paiement modifiée : réexaminer'; END IF;
 v_def:=regexp_replace(v_def,'\mBEGIN\M',E'BEGIN\n PERFORM public._paiement_soumission_verifier(_payload);','i');
 v_def:=replace(v_def,'PERFORM public.allocate_payment_to_invoice_lines(v_alloc_id);','-- Product-line allocation is optional; invoice allocations remain authoritative.');
 EXECUTE v_def;
 END LOOP;
END $patch$;