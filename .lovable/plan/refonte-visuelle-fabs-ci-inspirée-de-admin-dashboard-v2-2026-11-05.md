# Refonte visuelle FABS-CI — inspirée de « Admin Dashboard V2 »

La vidéo montre : barre latérale bleu pétrole translucide avec sections (Tableau de bord, Personnes, Activité, Système), page active en pastille bleu clair, barre de recherche en haut, avatar à droite, zone principale bleu nuit vers pétrole, cartes de chiffres « vitrées » qui se soulèvent au survol.

Adaptation professionnelle (sans dégradés appuyés ni effets lourds) :

## Lot 1 — Système de design commun (touche tout l'ERP d'un coup)
- Palette : bleu nuit (texte, en-têtes), bleu pétrole (couleur principale, boutons), bleu clair (fonds actifs, badges) ; orange FABS conservé uniquement pour les alertes.
- Fond de page très clair bleuté, cartes blanches à bordure fine et ombre légère, coins 12 px.
- Mode sombre : bleu nuit profond façon vidéo, cartes légèrement translucides.
- Boutons, champs, tableaux, filtres, fenêtres et onglets repris via les composants communs : aucun écran à recoder un par un.
- Police IBM Plex conservée.

## Lot 2 — Barre latérale et barre du haut
- Barre latérale bleu pétrole foncé, sections titrées, menus déroulants, page active en pastille bleu clair, réduction en icônes conservée.
- Barre du haut : recherche (Ctrl+K) élargie, avatar et nom à droite.

## Lot 3 — Tableau de bord
- Cartes : chiffre d'affaires, ventes, encaissements, créances clients, commandes, produits et stock (données réelles existantes).
- Graphiques financiers et activité commerciale restylés.

## Lot 4 — Vérification module par module
- Ouverture de chaque module (clients, produits, stocks, commandes, factures, BL, proformas, paiements, retours, colisage, étiquetage, commercial, comptabilité, rapports, paramètres), captures ordinateur et mobile, retouches ponctuelles.

## Ce qui ne change pas
Aucune donnée, règle, calcul, droit, PDF ou impression modifié. Les PDF gardent leur propre apparence.

## Technique
Couleurs dans `src/styles.css` (jetons oklch, clair et sombre), variantes des composants `src/components/ui/*`, `AppSidebar`/`Topbar`, `DashboardKpis`. Pas de nouvelle dépendance.
