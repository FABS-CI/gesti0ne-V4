# Écarts de format entre PDF et écran (Sprint 6)

Les générateurs PDF ont leur propre pipeline et n'ont pas été modifiés.

| Élément | Écran (`src/lib/format.ts`) | PDF / documents imprimables | Écart |
|---|---|---|---|
| Montant | `1 234 567 FCFA` (espace) | `1 234 567 FCFA`, espaces insécables retirées (bon de tournée) | Aucun visible |
| Date | `08/10/2026` | `08/10/2026` (`toLocaleDateString("fr-FR")` dans BonDocumentChrome) | Aucun visible, mais dépend du navigateur |
| Date + heure | `08/10/2026 14h32` | `08/10/2026 14:32` (bon de tournée) | Séparateur d'heure `h` vs `:` |
| Références | `|FC|26|51` (`formatDocumentReference`) | Référence stockée `FAC-2026-00051` | Volontaire (QR, certification) |
| Remise | `12,5 %` | `12,5 %` | Aucun |

À traiter dans un sprint PDF dédié : aligner l'heure sur `14h32` et faire passer BonDocumentChrome par `formatDate`.
