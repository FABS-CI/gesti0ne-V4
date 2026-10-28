-- Renommage d'un client (migration 0099) : ses documents certifiés ou signés DGI
-- gardent le nom signé, les autres prennent le nouveau nom. Tout est annulé en fin de script.
-- psql -v ON_ERROR_STOP=1 -f supabase/tests/noms_documents_certifies.test.sql
BEGIN;

DO $$
DECLARE v_client uuid; v_signee public.factures; v_libre public.factures; v_nom text := 'Client renommé (test 0099)';
BEGIN
  SELECT f.* INTO v_signee FROM public.factures f
   WHERE f.client_id IS NOT NULL AND public._document_signe(f.facture_id::text)
   LIMIT 1;
  IF v_signee.facture_id IS NULL THEN RAISE NOTICE 'aucune facture certifiée ou signée DGI, test ignoré'; RETURN; END IF;
  v_client := v_signee.client_id;
  SELECT f.* INTO v_libre FROM public.factures f
   WHERE f.client_id = v_client AND NOT public._document_signe(f.facture_id::text)
   LIMIT 1;

  UPDATE public.clients SET nom = v_nom WHERE client_id = v_client;

  ASSERT (SELECT client_nom FROM public.factures WHERE facture_id = v_signee.facture_id)
         IS NOT DISTINCT FROM v_signee.client_nom,
         'facture signée renommée : ' || v_signee.reference;
  IF v_libre.facture_id IS NOT NULL THEN
    ASSERT (SELECT client_nom FROM public.factures WHERE facture_id = v_libre.facture_id) = v_nom,
           'facture non signée non renommée : ' || v_libre.reference;
  END IF;
  RAISE NOTICE 'OK : % garde « % »', v_signee.reference, v_signee.client_nom;
END $$;

ROLLBACK;
