-- Aperçu de la migration 0088 (lecture seule) : soldes clients qui vont changer.
-- À lancer AVANT la migration : psql "$SUPABASE_DB_URL" -f scripts/apercu-solde-client.sql
--
-- retours_deja_deduits : retours validés rattachés à une facture et validés avant le 2026-08-06.
-- À cette époque, la validation diminuait aussi le montant de la facture : ces retours risquent
-- d'être comptés deux fois (dans la facture et au crédit), dans le relevé comme dans le nouveau solde.
WITH calc AS (
  SELECT c.client_id, c.nom, COALESCE(c.solde, 0) AS solde_actuel,
    COALESCE((SELECT sum(f.montant_total) FROM factures f
              WHERE f.client_id = c.client_id
                AND lower(COALESCE(f.statut, '')) NOT IN ('annule', 'annulee', 'avoir')), 0)
  - COALESCE((SELECT sum(pa.montant) FROM payment_allocations pa
              JOIN paiements p ON p.paiement_id = pa.paiement_id AND p.statut = 'valide'
              JOIN factures f ON f.facture_id = pa.facture_id
              WHERE f.client_id = c.client_id), 0)
  - COALESCE((SELECT sum(r.montant) FROM retours r
              WHERE r.client_id = c.client_id
                AND lower(COALESCE(r.statut, '')) IN ('valide', 'accepte', 'valide_compta', 'cloture')), 0)
    AS solde_nouveau,
    (SELECT count(*) FROM retours r
      WHERE r.client_id = c.client_id AND r.facture_id IS NOT NULL
        AND lower(COALESCE(r.statut, '')) IN ('valide', 'accepte', 'valide_compta', 'cloture')
        AND COALESCE(r.valide_compta_at, r.updated_at) < DATE '2026-08-06') AS retours_deja_deduits
  FROM clients c
)
SELECT client_id, nom, solde_actuel, solde_nouveau, solde_nouveau - solde_actuel AS ecart, retours_deja_deduits
FROM calc
WHERE abs(solde_nouveau - solde_actuel) > 0.01 OR retours_deja_deduits > 0
ORDER BY abs(solde_nouveau - solde_actuel) DESC;
