# Rapport d'audit — Comptabilité, phase 3 : tableau de bord et rapports comptables

Date : 03/11/2026 · Branche : `audit/compta-tableau-de-bord` · Migration : `0114_compta_tableau_de_bord.sql`

## Constats

| #   | Problème                                                                                                                                                                                                                                                 | Gravité | Correction                                                                                                                                        | Test                                 |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 1   | **Trésorerie, créances et dettes fausses** : calculées sur les seuls mouvements de l'exercice, sans les soldes d'ouverture. Exemple testé : 2 050 FCFA affichés pour 3 050 réellement en banque et en caisse. Même calcul dans le **Rapport d'exercice** | Majeure | Postes de bilan calculés sur la balance cumulée à la date de fin (ou au jour si l'exercice est en cours). Le Rapport d'exercice est corrigé aussi | Reproduit (2 050) ; 3 050 après      |
| 2   | Résultat sans les opérations hors activités ordinaires (classe 8)                                                                                                                                                                                        | Mineure | Résultat = produits - charges + classe 8 (net), affiché à part                                                                                    | Résultat 2 750 = 5 000 + 100 - 2 350 |
| 3   | Créances et dettes limitées aux comptes 411 et 401 : les sous-comptes 4111, 4011 étaient pris, mais pas les autres comptes 41 / 40                                                                                                                       | Mineure | Comptes 41 et 40 entiers                                                                                                                          | 4111 compté en créances              |
| 4   | Tableau de bord limité à six montants ; page **Rapports comptables vide**                                                                                                                                                                                | Majeure | Indicateurs, graphiques et rapports ci-dessous                                                                                                    | —                                    |

## Tableau de bord (exercice consulté)

Calculé en une seule requête par `compta_tableau_de_bord(exercice)` :

- **Résultat** : bénéfice ou perte, chiffre d'affaires (comptes 70), produits (classe 7),
  charges (classe 6), part hors activités ordinaires (classe 8).
- **Situation** à la date de fin : trésorerie (classe 5), créances clients (41), dettes
  fournisseurs (40), dettes sociales et fiscales (42 à 44).
- **Activité** : écritures (validées, en brouillon, annulées par contre-passation), comptes
  mouvementés, total des débits et des crédits (écart signalé), soldes débiteurs et créditeurs.
  L'ERP ne « rejette » pas d'écriture : une erreur se corrige par contre-passation, d'où le
  compteur « annulées ».
- **Graphiques** : produits et charges par mois, chiffre d'affaires mensuel, répartition
  des charges par compte principal (60 à 69). Couleurs vérifiées pour les daltoniens et le
  contraste, en mode clair et sombre.

## Rapports comptables

- Choix de l'exercice ; comparaison automatique avec l'exercice précédent (variation en %
  pour les montants, en points pour les ratios).
- 13 indicateurs : chiffre d'affaires, produits, achats (60), charges de personnel (66),
  charges, hors activités ordinaires, résultat, marge sur achats / CA, personnel / CA,
  résultat / CA, trésorerie, créances clients, dettes fournisseurs.
- Synthèse mensuelle : CA, produits, charges, résultat, résultat cumulé ; export PDF.

Aucune donnée n'est estimée : un mois sans écriture vaut zéro, un ratio sans chiffre
d'affaires affiche « — ».

## Vérifications

- Tests SQL (PGlite) : `src/lib/compta/tableau-de-bord.test.ts`, 7 tests (montants
  vérifiés à la main sur un jeu complet : capital 2024, vente, encaissement, achat, paie,
  produit HAO, brouillon, écriture contre-passée), dont la reproduction du défaut.
- Typecheck (tsgo) et ESLint : propres.
- Vitest : 590 tests passent. Seul échec : `no-direct-locale-format` sur `calendar.tsx`,
  connu, propre à Windows.
- **Non vérifié** : l'affichage réel des graphiques dans l'application en ligne (pas d'accès
  à la base), et l'application de 0114 sur la base réelle.
