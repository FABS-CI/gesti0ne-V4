# GESTI-one — Règles de direction visuelle

**Style :** Minimalism & Swiss Style, dense, mouvement discret. Interface de type ERP commercial.

## Palette
- Thème retenu : **cuivre sur ardoise** (tokens de `src/styles.css`). Neutres ardoise + un seul accent cuivre/orange (`--primary`).
- Le bleu de marque `--fabsci-blue-electric` reste réservé aux QR, étiquettes et au logo.
- Interdit : violet, dégradés de couleur, halos flous, couleurs hors tokens.

## Couleurs sémantiques (mapping des couleurs brutes)
| Couleur brute | Token |
|---|---|
| red-* | `destructive` |
| green-* / emerald-* | `success` |
| amber-* / yellow-* / orange-* (alerte) | `warning` |
| blue-* (information) | `info` |
| orange-* (action principale) | `primary` |
| slate-* / gray-* / zinc-* | `muted`, `muted-foreground`, `border`, `foreground` |

## Typographie
- Une seule famille sans-serif ; pile mono pour références, codes et n° de série.
- Titre de page 22 px / 600 · section 16 px / 600 · corps 14 px · secondaire 13 px muted · minimum absolu 12 px.
- `tabular-nums` obligatoire dans tableaux, KPI et montants.

## Formes et profondeur
- Rayon `rounded-md` par défaut, `rounded-lg` maximum (cartes). Pas de `rounded-2xl/3xl`.
- Ombres : aucune ou `shadow-sm` maximum. Pas de `backdrop-blur` décoratif.

## Mouvement
- Transitions 150–250 ms sur color / background / border / opacity uniquement.
- Respect de `prefers-reduced-motion`. Aucune animation d'entrée décorative.

## Densité
- Lignes de tableau 36–40 px ; espacements 8 / 12 / 16 px. Cibles tactiles ≥ 44 px sur mobile.

## Formatage
- Montants : `1 234 567 FCFA` via les fonctions centralisées, jamais `toLocaleString` dispersé.
- Références : stockées telles quelles, affichées via `formatDocumentReference`.
- Pas de `confirm()` / `alert()` natifs : dialogues shadcn. Messages d'erreur précis avec la suite à suivre.
- Aucun emoji, aucune icône « IA » (étincelles, baguette, robot).

## Accessibilité
- Contraste ≥ 4.5:1 (texte), ≥ 3:1 (bordures de champs). Focus visible partout. Boutons-icônes avec `aria-label`.
