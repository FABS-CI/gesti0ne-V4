CREATE OR REPLACE FUNCTION public._propager_nom_client(_client_id uuid, _nom text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  -- Documents non certifiés uniquement : un document certifié garde le nom signé
  -- dans son QR, sinon sa vérification publique le déclarerait falsifié.
  FOR r IN SELECT t, pk FROM public._renommage_doc_tables() LOOP
    EXECUTE format(
      'UPDATE public.%I d SET client_nom = $2 WHERE d.client_id = $1 AND d.client_nom IS DISTINCT FROM $2
         AND NOT EXISTS (SELECT 1 FROM public.document_certifications c WHERE c.document_id::text = d.%I::text)',
      r.t, r.pk) USING _client_id, _nom;
  END LOOP;
  UPDATE public.paiements p SET client_nom = _nom
   WHERE p.client_nom IS DISTINCT FROM _nom
     AND p.facture_id IN (SELECT facture_id FROM public.factures WHERE client_id = _client_id)
     AND NOT EXISTS (SELECT 1 FROM public.document_certifications c WHERE c.document_id::text = p.paiement_id::text);
END $$;
REVOKE EXECUTE ON FUNCTION public._propager_nom_client(uuid, text) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public._trg_clients_propager_nom()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.nom IS DISTINCT FROM OLD.nom THEN
    PERFORM public._propager_nom_client(NEW.client_id, NEW.nom);
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public._trg_clients_propager_nom() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS trg_clients_propager_nom ON public.clients;
CREATE TRIGGER trg_clients_propager_nom AFTER UPDATE OF nom ON public.clients
FOR EACH ROW EXECUTE FUNCTION public._trg_clients_propager_nom();

-- Rattrapage des noms déjà modifiés
DO $$ DECLARE c record; BEGIN
  FOR c IN SELECT client_id, nom FROM public.clients LOOP
    PERFORM public._propager_nom_client(c.client_id, c.nom);
  END LOOP;
END $$;