# Modernisation de l'ERP FABS-CI — plan par lots

Principe : on garde l'application et les données actuelles et on l'améliore lot par lot. Chaque lot suit les mêmes étapes : vérifier l'existant → mesurer → modifier → tester → valider avec vous. Les calculs (factures, paiements, stock, soldes), les PDF déjà validés et les droits d'accès restent inchangés, sauf demande explicite de votre part.

## Lot 1 — Centre de pilotage (premier chantier choisi)

Une nouvelle page « Centre de pilotage », accessible depuis le menu et proposée en haut du tableau de bord actuel, qui répond à la question « Que se passe-t-il aujourd'hui ? ».

**Activité du jour** (chaque carte ouvre la liste filtrée correspondante) :
- Factures impayées depuis plus de 30 jours (nombre et montant)
- Commandes à préparer (validées, sans colisage)
- Livraisons en retard
- Paiements reçus aujourd'hui (nombre et montant)
- Produits sous le seuil d'alerte (calculés à partir du stock réel des dépôts)
- Retours en attente de traitement

**Actions recommandées** : des phrases avec de vraies références, par exemple « Préparer CMD-2026-00051, 00052, 00053 », « Relancer 4 clients débiteurs », « Réapprovisionner 3 produits ». Chaque phrase a un bouton qui ouvre l'écran concerné. L'action elle-même est faite par la personne, jamais automatiquement.

**Vues par métier**, selon les droits de chacun :
- Direction : chiffre d'affaires, encaissements et reste à encaisser
- Commercial : commandes, meilleurs clients, clients débiteurs
- Logistique : colisage, tournées, retards
- Finance : impayés par ancienneté (0–30, 31–60, 61–90, plus de 90 jours)

Chaque personne ne voit que les blocs que ses droits actuels autorisent. Le montant du chiffre d'affaires reste visible uniquement avec la permission déjà prévue pour cela.

Objectif : la page s'affiche en moins de 1,5 seconde. Toutes les données sont calculées côté serveur et envoyées en une seule fois.

## Lot 2 — Centre de commande Ctrl+K

On améliore la recherche globale déjà en place, sans la remplacer :
- Recherche de clients, commandes, factures, bons de livraison, paiements et produits (insensible aux accents)
- Actions rapides : Nouvelle commande, Nouveau paiement, Nouveau retour, Relevé d'un client…
- Liste des éléments ouverts récemment
- Les droits d'accès sont respectés : une action interdite n'apparaît pas

## Lot 3 — Rapidité

- Mesure avant/après sur le tableau de bord et les grandes listes
- Pagination côté serveur sur les listes Commandes, Factures, Clients et Produits
- Découpage des écrans les plus lourds (formulaire de commande, colisage) sans changer leur fonctionnement
- Mise en cache et rafraîchissement ciblés après chaque enregistrement

## Lot 4 — Confort d'utilisation

Mêmes en-têtes, filtres, états vides, messages d'erreur et boutons sur tous les modules. Meilleur affichage sur tablette pour l'entrepôt (colisage, stock). Les couleurs et le logo actuels sont conservés.

## Lot 5 — Fiabilité et contrôle

- Le Centre de réconciliation s'étend aux contrôles de stock (stock des dépôts comparé aux mouvements)
- Le journal des actions est enrichi
- Les messages techniques laissés dans le code sont nettoyés
- Des tests automatiques de non-régression sont ajoutés pour les factures, les paiements, les retours et le transport

## Lot 6 — Documents et finitions

Vérification avant/après de tous les PDF, puis finitions visuelles.

À la fin de chaque lot, vous recevez un court rapport : ce qui a changé, ce qui a été testé à l'écran, les temps de chargement avant/après, et les risques qui restent.

---

## Détails techniques

**Lot 1**
- Nouvelle RPC `cockpit_overview(_exercice_id)` en `security definer`, avec des contrôles `has_permission` pour chaque bloc. Elle renvoie un JSON regroupant : activité du jour, listes de références à traiter (5 au maximum par action), impayés par ancienneté, et les indicateurs par métier.
- Sources réutilisées : `factures` (`montant_total`, `montant_paye`, `date_echeance`/`date_facture`), `commandes`/`colis` pour « à préparer », `tournees`/`livraisons` pour les retards, `paiements` (statut `valide`, `date_paiement` égale à aujourd'hui), `stocks_depots` cumulé par produit et comparé à `seuil_alerte` (et non au champ `produits.stock`), `retours` en attente.
- Aucune nouvelle table et aucune modification de données. Index ajoutés seulement si `EXPLAIN` montre qu'ils sont nécessaires.
- Route `src/routes/_authenticated/pilotage.tsx` avec `ensureQueryData` + `useSuspenseQuery`, `errorComponent`/`notFoundComponent`. Entrée `ROUTE_TO_PERMISSION` + `nav-data`. Encart de lien depuis `dashboard.index.tsx`.
- Les composants utilisent les jetons de design de `styles.css` et les liens `<Link>` avec des filtres passés dans l'URL vers les listes existantes.

**Lot 2** : extension de `GlobalSearch.tsx` et de la RPC `global_search`, actions filtrées par `usePermissions`, éléments récents enregistrés en localStorage (lus après le chargement de la page).

**Lot 3** : mesure avec `perf_query_log` et le Web Vitals existant. `range()` côté serveur avec `loaderDeps` et les paramètres d'URL. `CommandeForm` découpé en sections avec `lazy()`. Invalidation ciblée via `cache-invalidation.ts`.

**Lots 5–6** : vitest sur les calculateurs, scripts SQL `supabase/tests`, comparaison des PDF avec `scripts/qa-pdf-render.py`.

Chaque décision d'architecture est consignée dans `AGENTS.md` et l'avancement dans `roadmap.md`.
