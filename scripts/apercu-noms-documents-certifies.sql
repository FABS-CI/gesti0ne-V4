-- Aperçu de la migration 0099 (lecture seule) : documents certifiés ou signés DGI
-- dont le nom de client va être remis au nom signé.
-- À lancer AVANT la migration : psql "$SUPABASE_DB_URL" -f scripts/apercu-noms-documents-certifies.sql
--
-- source : « DGI » (nom déclaré dans fne_factures) ou « QR » (dernière certification avant 0098).
-- recertifie_apres_0098 : une certification plus récente porte peut-être déjà le nouveau nom ;
-- le document retrouvera son nom signé, à recertifier lors de sa prochaine édition PDF.
WITH docs AS (
  SELECT 'commandes' AS t, commande_id::text AS id, reference, client_nom FROM commandes
  UNION ALL SELECT 'factures', facture_id::text, reference, client_nom FROM factures
  UNION ALL SELECT 'proformas', proforma_id::text, reference, client_nom FROM proformas
  UNION ALL SELECT 'bons_livraison', bl_id::text, reference, client_nom FROM bons_livraison
  UNION ALL SELECT 'livraisons', livraison_id::text, reference, client_nom FROM livraisons
  UNION ALL SELECT 'retours', retour_id::text, reference, client_nom FROM retours
  UNION ALL SELECT 'specimens', specimen_id::text, reference, client_nom FROM specimens
  UNION ALL SELECT 'paiements', paiement_id::text, reference, client_nom FROM paiements
), signe AS (
  SELECT d.*,
    (SELECT nullif(btrim(f.client_nom), '') FROM fne_factures f
      WHERE f.facture_id::text = d.id AND f.statut = 'accepted' ORDER BY f.created_at LIMIT 1) AS nom_dgi,
    (SELECT nullif(btrim(c.snapshot->>'client_nom'), '') FROM document_certifications c
      WHERE c.document_id::text = d.id AND c.certified_at < '2026-10-28 14:16:27+00'
      ORDER BY c.version DESC LIMIT 1) AS nom_qr,
    EXISTS (SELECT 1 FROM document_certifications c
             WHERE c.document_id::text = d.id AND c.certified_at >= '2026-10-28 14:16:27+00') AS recertifie_apres_0098
  FROM docs d
)
SELECT t AS type_document, reference, client_nom AS nom_actuel,
       COALESCE(nom_dgi, nom_qr) AS nom_signe,
       CASE WHEN nom_dgi IS NOT NULL THEN 'DGI' ELSE 'QR' END AS source,
       recertifie_apres_0098
  FROM signe
 WHERE COALESCE(nom_dgi, nom_qr) IS NOT NULL
   AND client_nom IS DISTINCT FROM COALESCE(nom_dgi, nom_qr)
 ORDER BY t, reference;
