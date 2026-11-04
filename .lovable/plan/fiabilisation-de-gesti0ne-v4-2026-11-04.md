# Fiabilisation de GESTI0NE V4

## Objectif
Corriger progressivement les problèmes du diagnostic, sans refonte globale, suppression de modules ni modification des montants historiques.

## Lot 1 — Sécurité et protection des tests
- Empêcher les tests de se connecter automatiquement aux données réelles ; exiger une base de test explicitement autorisée et isolée.
- Faire respecter la suspension des comptes dans les contrôles serveur et les droits SQL, sans dépendre uniquement de la déconnexion.
- Protéger le statut et les champs administratifs des profils contre une modification par leur propriétaire.
- Exclure les rôles non actifs du calcul des droits, y compris la branche super-administrateur.
- Vérifier les lectures publiques des paramètres de paie et les limiter si leur exposition est confirmée ; préserver les clés publiques nécessaires aux QR.
- Corriger les faux positifs et les codes de sortie trompeurs des contrôles de sécurité.

## Lot 2 — Retours et comptabilité
- Refuser les lignes de réception dupliquées, étrangères au retour ou contenant des quantités invalides avant tout mouvement de stock.
- Empêcher le déplacement de lignes entre écritures de contourner les protections de l’écriture d’origine.
- Garantir la cohérence entre date comptable et exercice, sur création et modification.
- Corriger les reports fournisseurs devenus nuls lors d’une nouvelle clôture, en distinguant les reports générés des soldes saisis manuellement.
- Tester la concurrence clôture/comptabilisation et introduire un verrouillage commun si le risque est confirmé.

## Lot 3 — Actions et rapports
- Séparer les diagnostics FNE de la création et de la signature d’une facture ; ne jamais déclencher de déclaration de test en production.
- N’annoncer la réussite d’un PDF qu’après sa génération effective.
- Rendre les exports exhaustifs avec filtres côté serveur, pagination et vérification du nombre de résultats.
- Afficher les erreurs RH et de listes plutôt que des résultats vides trompeurs.
- Distinguer disponibilité réellement vérifiée et absence d’erreurs connues dans la santé des services ; réduire les comptages répétitifs.

## Méthode et validation
Chaque lot est livré avec ses tests et son bilan avant de passer au suivant. Commencer par le lot 1, puis conserver l’ordre sécurité → intégrité → fonctions et rapports.

- Reconfirmer les fonctions et politiques réellement déployées avant chaque correction : les anciennes alertes colisage, recherche globale et vue de permissions sont déjà corrigées et ne doivent pas être réappliquées inutilement.
- Avant toute modification SQL : vérifier une sauvegarde récente restaurable, documenter l’impact et préparer un retour arrière sans affaiblir les contrôles d’accès.
- Aucun test d’écriture, réception, suspension, clôture ou signature sur les comptes et documents réels.
- Ajouter des tests concrets pour les règles d’accès et d’intégrité ; exécuter les suites concernées dans un environnement isolé.
- Vérifier les pages concernées avec une session connectée ; ne pas déclarer les parcours sensibles validés sans environnement de test adapté.
- Produire un bilan par lot : corrections, preuves, limites et éventuels blocages. Aucune régularisation historique sans validation séparée.

## Détails techniques
- Conserver TanStack Start, les clients générés et les RPC métier existantes ; ne pas réécrire les modules.
- Appliquer les contrôles serveur dans les fonctions applicatives modifiables, sans éditer les fichiers d’intégration générés.
- Migrations additives via l’outil de migration existant, avec droits explicites, RLS et contrôles centralisés ; aucun calcul métier déplacé vers le navigateur.
- Tests SQL sur base jetable ; tests unitaires sans connexion héritée à la base du projet.

## Hors périmètre immédiat
Refonte graphique globale, changements de formules de paie, modification des écritures historiques et certification réglementaire. Ces travaux ne sont pas nécessaires aux corrections prioritaires.