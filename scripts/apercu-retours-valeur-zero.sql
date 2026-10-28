-- Retours validés enregistrés à une valeur différente de leurs lignes (lecture seule).
-- psql "$SUPABASE_DB_URL" -f scripts/apercu-retours-valeur-zero.sql
--
-- Avant la migration 0092, l'écran de validation comptable n'envoyait aucun montant : les retours
-- validés à la main ont été enregistrés à 0 FCFA (solde client non diminué, avoir à 0).
-- Cette liste sert à les régulariser avec la comptabilité ; elle ne modifie rien.
SELECT r.reference, r.numero, r.client_nom, r.statut, r.valide_compta_at,
       wa.decision_details->>'option' AS option_traitement,
       r.montant AS montant_enregistre,
       v.valeur AS valeur_des_lignes,
       av.reference AS avoir, av.montant_total AS montant_avoir
FROM retours r
CROSS JOIN LATERAL (
  SELECT COALESCE(sum(rl.total_ligne), 0)
         - ROUND(COALESCE(sum(rl.total_ligne), 0) * COALESCE(r.remise_globale_pct, 0) / 100.0) AS valeur
  FROM retour_lignes rl WHERE rl.retour_id = r.retour_id
) v
LEFT JOIN workflow_approvals wa ON wa.id = r.workflow_approval_id
LEFT JOIN factures av ON av.facture_id = r.avoir_facture_id
WHERE lower(COALESCE(r.statut, '')) IN ('valide', 'accepte', 'valide_compta', 'cloture')
  AND abs(COALESCE(r.montant, 0) - v.valeur) > 0.5
ORDER BY r.valide_compta_at NULLS LAST;
