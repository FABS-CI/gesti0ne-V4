# Audit ERP — module par module

Livrable par module : rapport (gravité) + correction des problèmes critiques.

## Modules
- [x] 1. Documents commerciaux (commandes, factures, proformas, BL, PDF/QR/vérification) — voir AUDIT-RAPPORT.md
- [x] 2. Clients & CRM — voir AUDIT-RAPPORT.md
- [x] 3. Stock, produits, dépôts, inventaires, transferts
- [x] 4. Paiements & comptabilité — voir AUDIT-RAPPORT.md
- [x] 5. Logistique (colisage, tournées, livraison-suivi, retours, incidents) — voir AUDIT-RAPPORT.md
- [x] 6. Achats & fournisseurs — voir AUDIT-RAPPORT.md
- [x] 7. RH & paie — voir AUDIT-RAPPORT.md
- [x] 8. Administration (rôles/permissions, sécurité, backup, paramètres) — voir AUDIT-RAPPORT.md
- [x] 9. Transverse : navigation/routes, recherche/filtres, responsive, notifications

Rapport cumulatif : AUDIT-RAPPORT.md

## Paiement multi-factures & Analyse des ventes
- [x] Socle base : payment_allocations / payment_line_allocations + RPC (source unique)
- [x] Interface paiement multi-factures (sélection, montants, récapitulatif, détail)
- [x] Reçu PDF multi-factures
- [x] Analyse des ventes : CA facturé / CA encaissé / Reste à encaisser (KPI, tableau produits, export Excel)
- [ ] Tests E2E navigateur du parcours complet (en attente d'autorisation de session de test)
