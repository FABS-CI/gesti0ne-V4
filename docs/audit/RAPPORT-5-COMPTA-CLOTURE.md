# Rapport d'audit — Comptabilité, phase 1 : clôture et report à nouveau

Date : 03/11/2026 · Branche : `audit/compta-cloture` · Migration : `0112_compta_cloture_exercice.sql`

Suite du rapport 1 (intégrité des écritures). Cette phase traite la clôture des exercices,
les à-nouveaux et la reprise des soldes d'un exercice à l'autre.

## Méthode et limites

- **Pas d'accès à la base réelle.** L'état de la base est déduit des migrations et de
  `src/integrations/supabase/types.ts`.
- **Tests sur un vrai PostgreSQL (PGlite)** : `src/lib/compta/cloture-exercice.test.ts`,
  16 tests. Deux d'entre eux **reproduisent les défauts sur les fonctions d'avant 0112**
  (versions de juillet), les autres vérifient la correction.
- **Choix conservé : la balance cumulée.** Le bilan se calcule sur toutes les écritures
  depuis l'origine (rapport États financiers, migration 0103). Passer des écritures
  d'à-nouveaux compterait les soldes deux fois. La continuité exigée par le SYSCOHADA (bilan
  d'ouverture N = bilan de clôture N-1) est donc garantie par le calcul et par le verrou des
  exercices clôturés (0108). Les à-nouveaux sont **calculés** et affichés, pas saisis.

## Bugs détectés et corrigés

| #   | Problème                                                                                                                                                                                                                                                 | Gravité  | Correction                                                                                                                                                                          | Test                                                              |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | L'aperçu de clôture renvoyait des compteurs, alors que l'écran attend `exercice`, `blocages` et `peut_cloturer` : **l'aperçu ne pouvait pas s'afficher** et le bouton restait grisé. Aucun contrôle (`anomalies` toujours vide)                          | Critique | `preview_cloture_exercice` renvoie le format de l'écran, avec les contrôles ci-dessous                                                                                              | Reproduit avant ; format vérifié après                            |
| 2   | **Clôture sans aucun contrôle** : écritures déséquilibrées, pièces non comptabilisées, exercice précédent ouvert, exercice non terminé                                                                                                                   | Critique | Contrôles bloquants, refaits par le serveur au moment de clôturer (pas seulement à l'écran)                                                                                         | Reproduit avant (clôture acceptée) ; refus après, un test par cas |
| 3   | **Impayés clients comptés deux fois** : la clôture les copiait en « solde d'ouverture », alors que l'état de compte et la liste des débiteurs reprennent déjà toutes les factures depuis l'origine. La liste des débiteurs en rajoutait à chaque clôture | Critique | La clôture ne crée plus de solde d'ouverture client. Ceux qui existent sont listés (Audit comptable), sans modification                                                             | Reproduit avant (800 reportés) ; aucun report après               |
| 4   | Report fournisseurs faux : achats **brouillons** reportés, impayés **des exercices antérieurs** oubliés, report ajouté une seconde fois après réouverture                                                                                                | Majeure  | Report = achats confirmés ou réceptionnés non payés à la date de clôture, tous exercices ; recalculé (pas ajouté) en cas de nouvelle clôture                                        | Reproduit avant (1 599 au lieu de 1 800) ; 1 800 après            |
| 5   | `compta_balance` regroupait par compte **et** libellé : un compte absent du plan comptable sortait sur autant de lignes que de libellés d'écritures                                                                                                      | Majeure  | Un compte, une ligne ; libellé du plan comptable, sinon celui des lignes                                                                                                            | Deux écritures sur 4711 → une ligne de 30                         |
| 6   | Aucun moyen de corriger une ancienne écriture manuelle déséquilibrée : verrouillée après 24 h, et sa contre-passation (déséquilibrée aussi) refusée par le contrôle d'équilibre                                                                          | Majeure  | `compta_neutraliser_ecriture` : écriture inverse à la même date, liée à l'originale, motif obligatoire, droit `comptabilite.modifier`. Bouton « Neutraliser » dans le rapprochement | Neutralisation tracée ; paire nulle dans la balance               |
| 7   | Pas d'exercice suivant : la clôture ne reportait rien et ne l'ouvrait pas                                                                                                                                                                                | Majeure  | Exercice suivant créé (12 mois, contigu) et activé si demandé ; refus s'il existe un trou entre les exercices                                                                       | Création 2026 ; refus avec 2027 seul                              |

## Contrôles de clôture

Bloquants (la clôture est refusée, à l'écran **et** dans la base) :

- exercice déjà clôturé, ou pas encore terminé ;
- exercice antérieur non clôturé ;
- écriture de l'exercice déséquilibrée ou sans lignes (paires neutralisées exclues) ;
- écriture dont la date ne correspond pas à l'exercice rattaché (elle échapperait au verrou) ;
- facture, paiement validé ou achat confirmé de l'exercice sans écriture active ;
- trou entre l'exercice et le suivant.

À vérifier (n'empêchent pas la clôture) :

- écritures équilibrées encore au statut brouillon (déjà dans la balance, elles deviennent
  définitives) ;
- soldes d'ouverture clients qui doublent des factures antérieures ;
- création de l'exercice suivant.

L'aperçu affiche aussi le nombre d'écritures, l'égalité débit = crédit, les produits, les
charges et le résultat. Chaque clôture est tracée dans le journal de clôture avec ces totaux.

## Report à nouveau

- **Balance → mode « Exercice »** (nouveau, par défaut) : balance à six colonnes. À-nouveaux
  = soldes cumulés des classes 1 à 5 à la veille de l'exercice ; les résultats antérieurs non
  affectés (classes 6 à 8) sont regroupés sur une ligne « 12 — Report à nouveau (calculé) »,
  exactement comme dans les états financiers. Chaque paire de colonnes est équilibrée (testé).
- Le mode « Période libre » reste disponible.

## Écrans modifiés

- `exercices.index.tsx`, `CloturePreviewDialog.tsx`, `exercices-shared.ts` : nouvel aperçu
  (totaux, résultat, anomalies bloquantes / à vérifier), textes de confirmation exacts.
- `balance.tsx`, `BalanceExerciceTable.tsx` (nouveau), `compta-api.ts` : balance d'exercice.
- `comptabilite.audit.tsx`, `ControleIntegriteCard.tsx` (bouton Neutraliser),
  `SoldesOuvertureDoublonsCard.tsx` (nouveau).
- `src/test/pg-migrations.ts` : lecture des fonctions écrites avec `$function$`.

## Décisions qui vous reviennent

1. **Soldes d'ouverture clients existants.** Si un exercice a déjà été clôturé avec l'ancien
   code, la page Audit comptable liste les soldes concernés. Pour chacun : reprise réelle
   d'avant l'ERP (à garder) ou report de clôture (à retirer). Rien n'est supprimé
   automatiquement.
2. **Affectation du résultat.** Elle reste calculée (report à nouveau). Si l'assemblée décide
   d'une autre affectation (réserves, dividendes), il faut la saisir en écriture d'OD.
3. **Écritures en brouillon.** Les anciennes saisies manuelles restent au statut brouillon ;
   elles sont signalées, pas bloquantes.

## Vérifications

- Typecheck (tsgo) : propre.
- ESLint sur les fichiers modifiés : propre, hors fins de ligne Windows de la copie locale
  et 6 remarques de mise en forme déjà présentes dans `comptabilite.audit.tsx`.
- Vitest : 572 tests passent, dont les 16 nouveaux. Seul échec : `no-direct-locale-format`
  sur `calendar.tsx`, connu, propre à Windows (il passe dans la CI Linux).
- **Non vérifié** : l'application de 0112 sur la base réelle et l'essai des écrans en ligne.
