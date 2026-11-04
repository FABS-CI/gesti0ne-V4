# GESTI-one — Règles de direction visuelle

**Style :** Admin Dashboard V2 sur une ergonomie de type Odoo : sobre, dense, mouvement discret. Interface de type ERP commercial.

## Palette
- Thème retenu : **bleu nuit, bleu pétrole, bleu clair** (« Admin Dashboard V2 », tokens de `src/styles.css`). Un seul accent d'action bleu (`--primary`), bleu pétrole pour l'information et la 2e série des graphiques (`--info`, `--chart-2`), bleu clair pour les fonds d'accent (`--accent`), barre latérale bleu nuit (`--sidebar`).
- Tous les modules partagent le même accent : plus de couleur propre par module (l'ancien `module-theme.ts` est supprimé), ni de palette propre au tableau de bord.
- Le bleu de marque `--fabsci-blue-electric` reste réservé aux QR, étiquettes et au logo.
- Interdit : violet, dégradés de couleur, halos flous, couleurs hors tokens (pas de `#hex` en dur dans l'interface ; les PDF ont leurs propres règles).

## Barre latérale
- Ordinateur : réductible en rail d'icônes (bouton de l'en-tête ou Ctrl+B) ; le survol du rail déploie le menu par-dessus le contenu, l'épingle le garde ouvert.
- Sous 1024 px : tiroir superposé (inchangé).

## Couleurs sémantiques (mapping des couleurs brutes)
| Couleur brute | Token |
|---|---|
| red-* | `destructive` |
| green-* / emerald-* | `success` |
| amber-* / yellow-* / orange-* (alerte) | `warning` |
| blue-* (information) | `info` |
| blue-* / orange-* (action principale) | `primary` |
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

## Couleur = état, jamais décoration
- Valeurs par défaut en `text-foreground`; une valeur à 0 est en `text-muted-foreground`.
- `text-destructive` : rupture, retard, résultat/trésorerie négatifs. `text-warning` : sous seuil, contrats expirant, congés en attente. `text-success` : signe positif d'un résultat uniquement.
- Une valeur colorée est toujours accompagnée d'un libellé texte (« À traiter », « En alerte », « Négatif »).
- Aucune icône dans les cartes KPI ni dans les titres de section du tableau de bord; aucune icône colorée (voir `KpiCard`, `SectionHeader`).
