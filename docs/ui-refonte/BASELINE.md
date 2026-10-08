# Refonte UI — état de départ (Sprint 0, 8 octobre 2026)

Mesuré par `bun run audit:ui` (scripts/ui-audit.mjs) sur 708 fichiers de `src/`,
hors `src/components/ui`, tests et fichiers générés.

| Indicateur | Occurrences | Fichiers |
|---|---:|---:|
| `<h1` brut | 132 | 123 |
| Couleurs Tailwind brutes (red/green/blue/amber/yellow/orange/emerald/slate/gray/zinc-NNN) | 526 | 104 |
| `text-[9px]` / `text-[10px]` / `text-[11px]` | 140 | 45 |
| Emojis / symboles (☐ ✓ ✗ 💾 ⚡ 🖨 ⚠ 🎉 🚨 ✅) dans les .tsx | 26 | 9 |
| Sparkles / Wand2 / WandSparkles / Bot | 6 | 3 |
| Dégradés (bg-gradient-, radial/linear-gradient) | 20 | 6 |
| backdrop-blur | 10 | 10 |
| shadow-lg / xl / 2xl | 11 | 10 |
| rounded-2xl / 3xl | 6 | 5 |
| toLocaleString / toLocaleDateString | 115 | 86 |
| « FCFA » en dur | 798 | 160 |
| `confirm(` / `alert(` natifs | 22 | 17 |
| « Une erreur est survenue » / « Impossible de » | 27 | 25 |

Note : le compteur « Dégradés » inclut le masque radial de la trame de la page de connexion
(volontaire, sans couleur). « FCFA » inclut les libellés légitimes des PDF.

## Variantes de className des `<h1>` (les plus fréquentes)

| Nombre | className |
|---:|---|
| 46 | `text-2xl font-bold` |
| 34 | `flex items-center gap-2 text-2xl font-bold` |
| 16 | `text-xl font-bold` |
| 3 | `text-2xl font-semibold` |
| 3 | `text-2xl font-bold flex items-center gap-2` |
| 2 | `truncate text-2xl font-bold` |
| 2 | `text-lg font-semibold leading-none` |
| 2 | `text-lg font-bold tracking-tight` |
| 2 | `text-2xl font-semibold flex items-center gap-2` |
| 2 | `flex items-center gap-2 text-3xl font-bold` |

## Sprint 2 (8 octobre 2026)
- 128 titres de page normalisés sur une seule variante `ds-page-title` (22 px / 600), couleurs brutes retirées.
- Composant `src/components/common/PageHeader.tsx` créé (title, description, breadcrumbs, badge, actions, backTo).
- Reste : migration page par page des titres + boutons voisins vers `PageHeader`, et règle de lint interdisant `<h1>` brut.

## Sprint 9 — lot 1 (8 octobre 2026)
- Ombres fortes, flous décoratifs, dégradés et coins très arrondis retirés (barre du haut, barres de filtres, KPI factures/produits, fenêtre d'inactivité, page de vérification, état vide, barre mobile).
- Restent volontairement : `text-[10/11px]` dans `BonDocumentChrome` (document imprimé), dégradés de défilement de `ResponsiveTable` (indice fonctionnel), `confirm(` = hook applicatif `useConfirm` (faux positifs de l'audit).
- Test de fumée `e2e/smoke-ui-refonte.spec.ts` (clair + sombre, sans erreur console, sans défilement horizontal).
- Restent pour les lots suivants : sidebar groupée, formulaires longs en sections, Lighthouse, passage sombre sur 10 écrans.
