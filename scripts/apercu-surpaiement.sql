-- Factures déjà surpayées ou en risque (lecture seule), à lancer avant et après la migration 0089 :
-- psql "$SUPABASE_DB_URL" -f scripts/apercu-surpaiement.sql
--   encaisse > total : déjà payée au-delà de son total (à régulariser) ;
--   engage   > total : des paiements en attente dépassent le reste ; la validation du dernier sera refusée.
SELECT f.reference, f.client_nom, f.montant_total,
       COALESCE(sum(pa.montant) FILTER (WHERE p.statut = 'valide'), 0) AS encaisse,
       COALESCE(sum(pa.montant) FILTER (WHERE p.statut IN ('valide', 'en_attente', 'en_attente_validation')), 0) AS engage,
       count(*) FILTER (WHERE p.statut IN ('en_attente', 'en_attente_validation')) AS paiements_en_attente
FROM factures f
JOIN payment_allocations pa ON pa.facture_id = f.facture_id
JOIN paiements p ON p.paiement_id = pa.paiement_id
WHERE f.montant_total >= 0 AND COALESCE(f.statut, '') <> 'avoir'
GROUP BY f.facture_id, f.reference, f.client_nom, f.montant_total
HAVING COALESCE(sum(pa.montant) FILTER (WHERE p.statut IN ('valide', 'en_attente', 'en_attente_validation')), 0)
       > f.montant_total + 0.01
ORDER BY engage - f.montant_total DESC;
