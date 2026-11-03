# Rapport d'audit — Comptabilité, phase 2 : plan comptable

Date : 03/11/2026 · Branche : `audit/plan-comptable` · Migration : `0113_plan_comptable.sql`

## Constats

| #   | Problème                                                                                                                                                                                                        | Gravité | Correction                                                                                                                                                                 | Test                                                            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 1   | Le plan ne contenait que **7 comptes**, alors que les écritures générées par l'ERP en utilisent 15 (la paie écrit sur 421, 422, 431, 447, 658, 661, 664, 758) : ces comptes sortaient sans libellé de référence | Majeure | Classes 1 à 9, comptes principaux (2 chiffres) du SYSCOHADA révisé, 15 comptes de l'ERP, comptes 121 / 129 / 131 / 139. Ajout seulement : un libellé existant est conservé | Présence des 15 comptes ; libellé « Banque » conservé           |
| 2   | La saisie manuelle acceptait **n'importe quel numéro** commençant par 1 à 9, avec un libellé de compte libre : une faute de frappe créait un compte fantôme dans la balance                                     | Majeure | Compte obligatoirement présent et actif dans le plan ; ligne liée au compte (`compte_id`) et libellé du plan                                                               | Reproduit avant (6999 accepté) ; refusé après                   |
| 3   | La page **Plan comptable était vide** (« bientôt disponible »)                                                                                                                                                  | Majeure | Vraie page : arborescence, recherche, filtres, mouvements et solde par compte, création et modification                                                                    | —                                                               |
| 4   | Un compte pouvait être **supprimé ou renuméroté** directement en base alors que des écritures l'utilisaient                                                                                                     | Majeure | Déclencheur : un compte utilisé ne se supprime pas et garde son numéro ; il se désactive                                                                                   | Renumérotation et suppression refusées ; désactivation acceptée |
| 5   | Aucun moyen de voir les comptes utilisés par des écritures mais **absents du plan**                                                                                                                             | Majeure | Listés avec leurs mouvements ; bouton « Ajouter au plan » (libellé le plus fréquent de leurs écritures, modifiable ensuite)                                                | 4711 et 6999 détectés puis ajoutés                              |

## Fonctions ajoutées

- `compta_plan_comptable()` : comptes du plan avec nombre de lignes, débit, crédit, dernier
  mouvement, et comptes absents du plan (`dans_plan = false`). Droit `plan_comptable.voir` ou
  `comptabilite.voir`.
- `compta_plan_enregistrer(id, numero, libelle, actif)` : création (droit
  `plan_comptable.creer`) ou modification (`plan_comptable.modifier`). Numéro : chiffres
  seulement, premier chiffre = classe ; libellé de 2 à 200 caractères ; pas de doublon. Classe,
  type et compte parent sont déduits du numéro.
- `compta_plan_importer_absents()` : ajoute les comptes absents (droit `plan_comptable.creer`).

## Écrans

- **Plan comptable** (`plan-comptable.tsx`) : comptes classés et décalés selon leur niveau,
  recherche par numéro ou libellé, filtres par classe, comptes mouvementés, absents du plan,
  désactivés. Alerte avec bouton d'ajout quand des comptes utilisés manquent au plan.
- **Nouvelle écriture** (`comptabilite.nouvelle.tsx`) : suggestions de comptes du plan,
  libellé du compte proposé, « Absent du plan » signalé sur la ligne, enregistrement bloqué
  tant qu'un compte est inconnu (le serveur le refuse de toute façon).

## À faire après la mise en production

1. Appliquer la migration **0113** avec Lovable.
2. Ouvrir **Plan comptable** : si l'alerte « comptes absents du plan » apparaît, vérifier la
   liste (filtre « Absents du plan ») puis cliquer sur « Ajouter au plan ». Corriger ensuite
   les libellés si besoin.
3. Faire valider par l'expert-comptable les libellés et créer les sous-comptes utiles
   (par exemple 4111, 5211) : le plan reste modifiable depuis l'écran.

## Limites

- Les écritures **générées** (factures, paiements, paie…) ne sont pas bloquées par le plan :
  un compte manquant ne doit pas empêcher d'enregistrer une facture. Les comptes qu'elles
  utilisent sont tous dans le plan, et tout écart apparaît dans l'alerte de la page.
- Le référentiel ajouté couvre les classes et comptes principaux, pas le détail complet du
  SYSCOHADA (plusieurs centaines de sous-comptes) : à compléter selon les besoins réels.

## Vérifications

- Tests SQL (PGlite) : `src/lib/compta/plan-comptable.test.ts`, 11 tests, dont la
  reproduction du défaut de saisie sur la fonction d'avant 0113.
- Typecheck (tsgo) et ESLint sur les fichiers modifiés : propres.
- Vitest : 583 tests passent. Seul échec : `no-direct-locale-format` sur `calendar.tsx`, connu,
  propre à Windows (il passe dans la CI Linux).
- **Non vérifié** : l'application de 0113 sur la base réelle et l'essai des écrans en ligne.
