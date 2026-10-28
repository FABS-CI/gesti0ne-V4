CREATE OR REPLACE FUNCTION public._propager_nom_client(_client_id uuid, _nom text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; _n text := btrim(_nom);
BEGIN
  -- Le nom actuel du client s'applique à tous ses documents (choix utilisateur) ;
  -- un document certifié est recertifié en nouvelle version à sa prochaine édition PDF.
  FOR r IN SELECT t FROM public._renommage_doc_tables() LOOP
    EXECUTE format('UPDATE public.%I SET client_nom = $2 WHERE client_id = $1 AND client_nom IS DISTINCT FROM $2', r.t)
      USING _client_id, _n;
  END LOOP;
  UPDATE public.paiements p SET client_nom = _n
   WHERE p.client_nom IS DISTINCT FROM _n
     AND p.facture_id IN (SELECT facture_id FROM public.factures WHERE client_id = _client_id);
END $$;
REVOKE EXECUTE ON FUNCTION public._propager_nom_client(uuid, text) FROM public, anon, authenticated;

DO $$ DECLARE c record; BEGIN
  FOR c IN SELECT client_id, nom FROM public.clients LOOP
    PERFORM public._propager_nom_client(c.client_id, c.nom);
  END LOOP;
END $$;