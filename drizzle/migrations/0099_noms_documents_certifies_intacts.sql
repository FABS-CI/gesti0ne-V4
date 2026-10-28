-- Un document certifié (QR) ou une facture signée DGI garde le nom de client signé.
-- 0098 propageait le nouveau nom à tous les documents : le document affiché ne
-- correspondait plus au QR ni à la facture déclarée à la DGI. Ici :
--   1. la propagation ignore de nouveau les documents certifiés ou signés DGI ;
--   2. ceux que 0098 a renommés retrouvent leur nom signé.
-- Aperçu en lecture seule avant application : scripts/apercu-noms-documents-certifies.sql

-- Document certifié ou facture acceptée par la DGI.
CREATE OR REPLACE FUNCTION public._document_signe(_document_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.document_certifications c WHERE c.document_id::text = _document_id)
      OR EXISTS (SELECT 1 FROM public.fne_factures f
                  WHERE f.facture_id::text = _document_id AND f.statut = 'accepted');
$$;
REVOKE EXECUTE ON FUNCTION public._document_signe(text) FROM public, anon, authenticated;

-- Nom signé : celui déclaré à la DGI, sinon celui de la dernière certification
-- antérieure à 0098 (28/10/2026 14:16 UTC). Une certification faite après 0098
-- peut déjà porter le nouveau nom, elle n'est donc pas une source fiable.
CREATE OR REPLACE FUNCTION public._nom_client_signe(_document_id text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT nullif(btrim(f.client_nom), '') FROM public.fne_factures f
      WHERE f.facture_id::text = _document_id AND f.statut = 'accepted'
      ORDER BY f.created_at LIMIT 1),
    (SELECT nullif(btrim(c.snapshot->>'client_nom'), '') FROM public.document_certifications c
      WHERE c.document_id::text = _document_id AND c.certified_at < '2026-10-28 14:16:27+00'
      ORDER BY c.version DESC LIMIT 1));
$$;
REVOKE EXECUTE ON FUNCTION public._nom_client_signe(text) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public._propager_nom_client(_client_id uuid, _nom text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; _n text := btrim(_nom);
BEGIN
  -- Le nom actuel s'applique aux documents non signés ; les listes affichent de
  -- toute façon le nom actuel du client (withLiveClientNom).
  FOR r IN SELECT t, pk FROM public._renommage_doc_tables() LOOP
    EXECUTE format(
      'UPDATE public.%I d SET client_nom = $2 WHERE d.client_id = $1 AND d.client_nom IS DISTINCT FROM $2
         AND NOT public._document_signe(d.%I::text)',
      r.t, r.pk) USING _client_id, _n;
  END LOOP;
  UPDATE public.paiements p SET client_nom = _n
   WHERE p.client_nom IS DISTINCT FROM _n
     AND p.facture_id IN (SELECT facture_id FROM public.factures WHERE client_id = _client_id)
     AND NOT public._document_signe(p.paiement_id::text);
END $$;
REVOKE EXECUTE ON FUNCTION public._propager_nom_client(uuid, text) FROM public, anon, authenticated;

-- Rattrapage : nom signé rendu aux documents que 0098 a renommés.
DO $$ DECLARE r record; n int; total int := 0; BEGIN
  FOR r IN SELECT t, pk FROM public._renommage_doc_tables() UNION ALL SELECT 'paiements', 'paiement_id' LOOP
    EXECUTE format(
      'UPDATE public.%I d SET client_nom = s.nom
         FROM (SELECT x.%I AS id, public._nom_client_signe(x.%I::text) AS nom FROM public.%I x) s
        WHERE d.%I = s.id AND s.nom IS NOT NULL AND d.client_nom IS DISTINCT FROM s.nom',
      r.t, r.pk, r.pk, r.t, r.pk);
    GET DIAGNOSTICS n = ROW_COUNT;
    total := total + n;
    RAISE NOTICE '% : % document(s) remis au nom signé', r.t, n;
  END LOOP;
  RAISE NOTICE 'Total : % document(s)', total;
END $$;
