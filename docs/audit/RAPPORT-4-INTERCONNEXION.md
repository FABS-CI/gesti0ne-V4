# Rapport d'audit — Interactions Finances / Comptabilité / RH (GESTIONE V4)

Date : 30/10/2026 · Branche : `audit/interconnexion` (basée sur `audit/rh`) · Migration :
`0111_controle_integrite_global.sql`

Dernière étape de l'audit, après la Comptabilité (rapport 1), les Finances (rapport 2) et
les RH (rapport 3). Même méthode : l'état est établi à partir des migrations, les
corrections sont idempotentes et testées sur un vrai PostgreSQL (PGlite) dans
`src/lib/compta/controle-integrite-global.test.ts` (6 tests).

## Carte des flux

| Pièce de gestion                 | Module   | Écriture générée                      | Déclencheur (pièce)                     | Annulation                     |
| -------------------------------- | -------- | ------------------------------------- | --------------------------------------- | ------------------------------ |
| Facture client                   | Ventes   | VTE : 411 / 701 (TTC, voir rapport 1) | `trg_factures_ecriture` (`FACT:<id>`)   | Contre-passation (0108)        |
| Paiement client validé           | Finances | BAN ou CAI : 52x ou 57x / 411         | `trg_paiements_ecriture` (`PAI:<id>`)   | Contre-passation (0108)        |
| Retour (diminution du solde)     | Ventes   | OD : 701 / 411                        | `generate_ecriture_retour` (`RET:<id>`) | —                              |
| Achat confirmé                   | Achats   | ACH : 601 / 401                       | `trg_achats_ecriture` (`ACH:<id>`)      | Contre-passation (0108)        |
| Bulletin de paie validé          | RH       | OD : 661, 664 / 422, 431, 447, 421    | `trg_bulletin_ecriture` (`BUL:<id>`)    | `paie_annuler_bulletin` (0110) |
| Transaction (recette ou dépense) | Finances | **aucune**                            | —                                       | Statut « annulé » (0109)       |
| Achat payé                       | Achats   | **aucune** (pas de 401 / 52x)         | —                                       | —                              |
| Bulletin payé                    | RH       | **aucune** (pas de 422 / 52x)         | —                                       | —                              |

Tous les générateurs existants sont **idempotents** (une pièce, une écriture, retrouvée par sa
référence `TYPE:<id>`). Depuis 0108, ils sont aussi **traçables** : on contre-passe, on ne
supprime pas. Aucun ne s'exécute en dehors de l'action de l'utilisateur sur la pièce. Il n'y a
donc pas de synchronisation automatique non maîtrisée.

## Bugs détectés et corrigés

| #   | Problème                                                                                                                                                                                                 | Gravité | Fichier                                                                                 | Correction                                                                                                                                                                                                            | Test                                                                                                                         | Résultat                                                                |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1   | **Aucun rapprochement entre modules** : rien ne signalait une facture, un paiement ou un achat validé sans écriture, une écriture qui ne correspond plus à sa pièce, ou l'écriture d'une pièce supprimée | Majeure | `0111` (`controle_integrite_global`), `ControleIntegriteCard.tsx`, page Audit comptable | Contrôle en lecture seule, réservé au droit `comptabilite.voir`, qui regroupe Ventes et encaissements, Achats, Paie (0110) et Comptabilité (écritures déséquilibrées). Une carte de la page Audit comptable l'affiche | Pièces conformes ; écarts reproduits (montant modifié, paiement sans écriture, facture supprimée, écriture bancale, salaire) | Aucune anomalie, puis les 5 anomalies signalées ; aucune écriture créée |
| 2   | **Risque de double comptage des salaires** : un salaire saisi dans Finances (catégorie « salaire ») s'ajoute au bulletin, déjà comptabilisé en 661 / 422                                                 | Majeure | `0111`                                                                                  | Ces transactions sont signalées « à rapprocher des bulletins » ; elles ne sont pas supprimées                                                                                                                         | Transaction « salaire » validée                                                                                              | Signalée                                                                |
| 3   | Le rapport « Recettes et dépenses » (écran Rapports) comptait les transactions **en attente et annulées**, contrairement à l'écran Finances corrigé (rapport 2)                                          | Majeure | `rapports-index-defs.ts`                                                                | Totaux sur les transactions validées ; le statut s'affiche en colonne                                                                                                                                                 | Typecheck                                                                                                                    | Les deux écrans donnent les mêmes totaux                                |
| 4   | `calcul_solde_fournisseur` comptait les transactions annulées ou en attente comme des paiements fournisseurs                                                                                             | Mineure | `0111`                                                                                  | Seules les transactions validées comptent. La clôture actuelle n'utilise plus cette fonction                                                                                                                          | Une transaction validée et une en attente de 400                                                                             | Solde 600 (et non 200)                                                  |

Corrections des rapports précédents qui concernent aussi les échanges entre modules :

- une seule comptabilisation par facture et par paiement (0109) ;
- contre-passation au lieu de suppression (0108) ;
- bulletins verrouillés et annulation tracée (0110) ;
- déclarations sociales et fiscales limitées aux bulletins comptabilisés (rapport 3).

## Écarts structurels restants (décisions à prendre)

Ce sont les principales sources d'écart entre la trésorerie, les comptes et la paie. Aucune
n'est corrigée automatiquement : chacune demande de choisir les comptes et les règles, et les
générer sans décision créerait justement une synchronisation non maîtrisée.

| Écart                                                                                                                                                                                                                     | Gravité  | Conséquence                                                                                                                   | Proposition                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Les décaissements ne sont pas comptabilisés** : achats payés, salaires payés, dépenses saisies dans Finances                                                                                                            | Critique | Les comptes 52x et 57x ne reçoivent que les encaissements clients : trésorerie comptable surévaluée, 401 et 422 jamais soldés | Écritures de règlement idempotentes (`REGL-ACH:<id>`, `REGL-BUL:<id>`, `TRX:<id>`), contre-passées à l'annulation. Pour cela : ajouter le mode et la date de paiement aux achats, et définir la correspondance catégorie → compte des transactions |
| **Deux sources de trésorerie** : l'écran Finances (transactions saisies) et la comptabilité (paiements clients) ne se recoupent pas. Un encaissement client peut être saisi deux fois (paiement et transaction « vente ») | Majeure  | Soldes différents selon l'écran                                                                                               | Définir le rôle de Finances : soit un **journal de caisse** comptabilisé (et non une saisie parallèle), soit des dépenses diverses seulement, sans les ventes ni les salaires                                                                      |
| Le **tableau de bord** de direction calcule « Solde = paiements encaissés − achats payés » : il omet les salaires et les dépenses de Finances                                                                             | Majeure  | Indicateur optimiste, différent du résultat comptable                                                                         | Lire le solde des comptes 52x et 57x une fois les règlements comptabilisés                                                                                                                                                                         |
| Les retours autres que « diminuer le solde » (remboursement, échange) ne génèrent pas d'écriture                                                                                                                          | Moyenne  | Avoirs remboursés absents des comptes                                                                                         | À définir avec l'expert-comptable                                                                                                                                                                                                                  |
| La clôture reporte les soldes clients à partir de `factures.montant_paye` (et non des comptes 411), et ne vérifie ni l'équilibre ni les anomalies du contrôle                                                             | Majeure  | Un exercice peut être clos avec des écarts                                                                                    | Bloquer la clôture tant que `controle_integrite_global()` signale des anomalies, sauf dérogation motivée                                                                                                                                           |

## Vérifications

- Typecheck : propre. ESLint : aucune nouvelle erreur sur les fichiers modifiés.
- Vitest : 556 tests passent, dont 42 tests SQL (Comptabilité 17, Finances 9, Paie 10,
  interconnexion 6). Le seul échec, `calendar.tsx`, est connu et propre à Windows.
- **Non vérifié** : l'application des migrations 0108 à 0111 sur la base réelle. Elles
  s'appliquent dans l'ordre, avec Lovable. Il faut ensuite lancer le contrôle depuis la page
  Audit comptable pour mesurer l'état réel des données.

## Ordre de mise en production conseillé

1. Fusionner les PR dans l'ordre : Comptabilité, Finances, RH, Interconnexion.
2. Appliquer les migrations 0108 → 0111.
3. Ouvrir la page Audit comptable, puis traiter les anomalies une par une, par annulation ou
   contre-passation. Ne jamais supprimer.
4. Trancher les décisions en attente :
   - l'ITS 2024 (rapport 3) ;
   - la comptabilisation des décaissements ;
   - le rôle de l'écran Finances.
5. Créer le secret `SUPABASE_DB_URL` pour que la CI vérifie les droits d'accès (RLS) de la
   base réelle.
