# Audit ERP — module par module

## Style sobre premium — demande du 9 novembre 2026
- [x] Réglages globaux : couleurs chaudes, bleu pétrole, Inter, arrondis, ombres légères, pastille de statut
- [x] Menu : rubriques Pilotage / Activité / Gestion, module actif bleu pétrole plein
- [x] Tableau de bord : en-tête, cartes de chiffres, graphique, « À traiter », dernières factures, meilleurs clients
- [x] Liste des factures : résumé 4 cases, onglets, filtres, tableau, menu ⋯, pagination
- [x] Style des tableaux appliqué à toutes les listes (en-tête, lignes, survol)
- [x] Nouveau style (en-tête, carte unique, onglets) sur proformas, commandes, paiements, clients, produits, stock, fournisseurs, achats — 8 écrans ouverts connectés sans erreur
- [x] Autres listes : colisage, employés, transferts, incidents, inventaires, retours (tournées et paie via le style partagé) — ouvertes connectées sans erreur
- [x] Bons de livraison, suivi des livraisons, journal comptable, congés, dépôts — ouverts connectés sans erreur
- [x] Alertes de stock (onglets par sévérité), grand livre, exercices — ouverts connectés sans erreur
- [x] Balance, rapport d'exercice, comparatif, journal de clôture — ouverts connectés sans erreur
- [x] Spécimens, employés en congé, notifications, états de compte clients — ouverts connectés sans erreur
- [x] Plan comptable, journal d'audit, centre de documents — ouverts connectés sans erreur
- [x] Coûts logistiques, rapports logistique, rapports de paie, export & sauvegarde — ouverts connectés sans erreur
- [ ] Journal d'audit : compteur « 500 / 0 événement(s) » et « Événements sur la période 0 » incohérents (existant, à vérifier si l'utilisatrice le souhaite)
- [x] Écart achats comparatif / rapport d'exercice : le comparatif ignorait les achats « Reçu » — corrigé (migration 0120), 13 770 000 FCFA des deux côtés

## Glassy Sidebar V7 — demande du 9 novembre 2026
- [x] Affichage V7 signalé invisible à 09:46 : contrôle connecté conforme en clair, sombre, rail et tiroir mobile, sans erreur ; capture remise et rechargement conseillé, aucune régression de code reproduite
- [x] Intégrer le panneau vitré développé en permanence sur ordinateur, avec icônes et noms de modules
- [x] Conserver les sous-menus, le filtrage des permissions, le profil, la déconnexion et le tiroir mobile
- [x] Contrôler compilation, navigation et parcours connectés desktop/mobile : 69 liens, rail, bulles, clavier, recherche, compte, profil et déconnexion ; aucune erreur console/réseau, 694 tests réussis
- [x] Analyser la vidéo de référence envoyée à 09:09 : panneau flottant arrondi et icônes de chaque lien intégrés
- [x] Appliquer le prompt de 09:18 : verre clair/sombre, rail avec bulles de sous-pages, recherche, exercice et carte utilisateur ; routes et RBAC conservés

## Titres PDF uniques — demande du 6 novembre 2026
- [ ] Auditer les générateurs partagés et spécifiques de tous les modules
- [ ] Supprimer uniquement les titres principaux dupliqués ; conserver identité, sous-titres, tableaux, filtres et montants
- [ ] Générer plusieurs PDF, contrôler leur pagination et livrer le bilan avec les limites de vérification

## Bon de retour — demande du 5 novembre 2026
- [x] Vérifier RET-261104-001 et ses données d’origine en lecture seule : 500 facturés, 100 retournés, remise globale 25 %, montant enregistré 225 000
- [x] Corriger références affichées, représentant et remises sans modifier l’historique ; origine reprise lors de la sélection de facture
- [x] Vérifier données écran/PDF du vrai bon connecté, mobile sans débordement, 31 tests réussis ; aucune création ni modification de données

## Audit intégral GESTI0NE V4 — 4 novembre 2026
- [x] Phase 1 : diagnostic initial livré dans audit-gesti0ne-v4-2026-11-04.md (Files) ; 598 tests sûrs réussis, 221 écritures contrôlées, 4 pages connectées ; limites et tentatives SQL rejetées documentées
- [ ] Couverture exhaustive : parcours sensibles, concurrence, vues publiques et tous les PDF — nécessite un environnement de test jetable avant les opérations d’écriture
- [x] Phase 2 : plan priorisé préparé après le « go » du 4 novembre
- [ ] Phases 3 à 5 : plan approuvé ; lot 1 commencé, lots 2 et 3 attendent sa validation
- [x] Lot 1 : tests de retours protégés par URL locale jetable explicite et rollback ; scanner SQL corrige garde déléguée et code de sortie ; 15 tests ciblés passent, test SQL passe
- [x] Lot 1 : contrôle de statut dans les fonctions serveur, suspension Auth par identifiant avec erreurs contrôlées ; compilation validée
- [ ] Lot 1 : droits SQL, rôles actifs et champs de profil — bloque sur simulation de restauration authentifiée : session expirée, renouvellement personnel indisponible ; aucune migration appliquée
- [x] Lot 1 : validation connectée du contrôle de statut (compte actif : tableau de bord, clients, paie, comptabilité OK)
- [ ] Lot 1 : session perdue au rechargement quand « Se souvenir de moi » est décoché — à analyser

## Paramètres Paie CI — demande du 22 octobre 2026
- [ ] Source unique régime, paramètres éditables et audit, suppression du chemin legacy
- [ ] Calcul serveur et aperçu : CMU 500 chacun, ITS 2024 nul, ancienneté, transport et arrondi supérieur à 5
- [ ] Simulation, tests unitaires/SQL par régime et PDF du cas de référence, contrôle visuel

## Liens clients et produits (file-80)
- [ ] Enrichir les lectures avec les identifiants réels, par lots de 200
- [ ] Liens sur les écrans internes demandés, sans modifier PDF/public/sélecteurs
- [ ] Tests du repli sans identifiant et clic sans propagation, navigation réelle

Livrable par module : rapport (gravité) + correction des problèmes critiques.

## Modules
- [x] 1. Documents commerciaux (commandes, factures, proformas, BL, PDF/QR/vérification) — voir AUDIT-RAPPORT.md
- [x] 2. Clients & CRM — voir AUDIT-RAPPORT.md
- [x] 3. Stock, produits, dépôts, inventaires, transferts
- [x] 4. Paiements & comptabilité — voir AUDIT-RAPPORT.md
- [x] 5. Logistique (colisage, tournées, livraison-suivi, retours, incidents) — voir AUDIT-RAPPORT.md
- [x] 6. Achats & fournisseurs — voir AUDIT-RAPPORT.md
- [x] 7. RH & paie — voir AUDIT-RAPPORT.md
- [x] 8. Administration (rôles/permissions, sécurité, backup, paramètres) — voir AUDIT-RAPPORT.md
- [x] 9. Transverse : navigation/routes, recherche/filtres, responsive, notifications

Rapport cumulatif : AUDIT-RAPPORT.md

## Paiement multi-factures & Analyse des ventes
- [x] Socle base : payment_allocations / payment_line_allocations + RPC (source unique)
- [x] Interface paiement multi-factures (sélection, montants, récapitulatif, détail)
- [x] Reçu PDF multi-factures
- [x] Analyse des ventes : CA facturé / CA encaissé / Reste à encaisser (KPI, tableau produits, export Excel)
- [ ] Tests E2E navigateur du parcours complet (en attente d'autorisation de session de test)

## Correctifs PDF facture & validation transport
- [ ] PDF depuis Commandes et Factures : identifiant facture transmis, paiement affiché
- [ ] Validation immédiate : fenêtre transport et transmission atomique des frais
- [ ] Vérifications ciblées sur FAC-2026-00024 et création de commande

## Cachet comptabilité des documents de vente
- [x] Remplacer le bloc texte du bon de commande par le véritable cachet
- [x] Agrandir et contrôler visuellement le cachet sur facture, bon de commande et proforma

## Audit réconciliation (file-20)
- [x] Suppression définitive d'un paiement : recalcul factures + solde client (LIBRAIRIE BELLO corrigé à 33 190 000)
- [x] Validation / rejet d'un paiement : recalcul de toutes les factures affectées
- [x] Centre de réconciliation (page Qualité des données)
- [ ] Bon de retour, documents vides, 8 tests de non-régression, rapport final
- [x] Relevé LIBRAIRIE BELLO : retours non validés compta exclus (33 190 000)

## Lots file-23/24/25 (qualité & sécurité)
- [x] Lot 1 : 7 bugs confirmés corrigés
- [x] Lot 2.1 : garde super admin sur secListScopeRefs
- [x] Lot 2.2-2.3 : filtres .or() neutralisés (pgSafe); secrets déjà comparés en temps constant
- [ ] Lot 3 : A, B, C et E terminés; 40 erreurs corrigées, shims retirés, `noImplicitAny` activé; D avancé de 28 à 1 fichier métier protégé. Blocage documenté : le type généré de `sec_replace_user_scope._principal` refuse `null`, alors que la fonction SQL accepte volontairement l'absence de dépôt principal. `routeTree.gen.ts` reste généré.
- [ ] Lots 4, 5, 6 (6A = audit seul, attendre réponse)

## Documents retours et relevés (file-26/27)
- [x] Relevé : séparer Total Paiement et Total Retours, conserver un solde unique sans double comptage
- [x] Bon de retour : reprendre facture, client, quantités, prix et remise; retirer statuts intermédiaires, synthèses et signatures du PDF
- [ ] Vérification visuelle des deux PDF et parcours réel en lecture seule

## Modernisation ERP (file-40, plan par lots)
- [x] Lot 1 : Centre de pilotage (/pilotage) — activité du jour, actions recommandées, direction, impayés par ancienneté
- [x] Lot 2 : Centre de commande Ctrl+K (actions, récents, pages, recherche)
- [x] Lot 3 : Rapidité — mesuré (listes déjà paginées côté serveur, requêtes < 110 ms, ouvertures 0,1–1,3 s en mode dev); recherche Clients/Produits sécurisée (virgules/parenthèses). Découpage CommandeForm reporté (gain non mesurable)
- [x] Lot 4 : Confort d'utilisation / tablette (menu en tiroir < 1024 px, en-têtes qui passent à la ligne)
- [x] Lot 5 : Fiabilité — réconciliation stock (lecture seule) dans Qualité des données; journal enrichi (résumé des changements champ par champ dans le détail d'un événement); messages techniques de débogage retirés (RouteGuard, use-permissions, use-visible-groups, EtiquettesSection); tests automatiques : transport (frais-transport.test.ts), journal (audit-helpers.test.ts), ajoutés aux tests existants facturation/paiements/retours/solde — 46 tests verts. En attente : validation par l'utilisateur des 2 écarts de stock (FABS-CI95, FABS-CI29)
- [x] Lot 6 : Documents et finitions — contrôle automatique des PDF remis à jour; vraies factures FAC-2026-00068/00069 comparées avant/après; frais de livraison affichés une seule fois (bloc des totaux)

## Audit file-71 (lot par lot, attendre « OK »)
- [x] Lot 0 : vérifications en base
- [x] Lot 1 : encaissements validés, retours, transferts
- [x] Lot 2 : 2.1 sans objet, 2.2, 2.3, 2.5, 2.6 faits
- [x] Lot 2.4 : vérification publique sans code secret — seuls référence, date et état de certification (fait)
- [x] Lot 3 : sauvegarde et restauration (3.1, 3.2, 3.3)
- [x] Lot 4 : 4.1, 4.2 (1-3), 4.3 (partiel), 4.4 faits
- [x] Lot 4 : décisions utilisateur appliquées
- [x] Lot 4.5 : 3 écarts signalés comme exceptions acceptées

## Refonte Analyse des ventes
- [x] Lot 1 correctifs et fondations
- [x] Lot 2 barre de filtres compacte
- [x] Lot 3 indicateurs et évolution
- [x] Lot 4 analyse unifiée
- [x] Lot 5 tableau produits
- [ ] Lots 3 à 6

## PDF Rapport produits
- [ ] Refonte portrait et export complet, sans changer les autres documents
- [ ] Tests purs et contrôles visuels avant/après (1, 25, 120 produits)
- [ ] Rapport de livraison et propositions de corrections non exécutées

## Liens clients et produits (file-80)
- [x] Liens clients : paiements, DGI, livraisons, rapport transport, fiche facture
- [x] Liens produits : lignes de la fiche facture
- [x] Tests attachClientIds (lots de 200, client introuvable)

## Refonte paie (régime ITS 2024)
- [x] Moteur de calcul régimes 2024/2022 + tests de référence
- [x] Migration (régimes, champs employés/bulletins, lignes) — reste: coordonnées entreprise (raison sociale, CNPS 366145, cachet)
- [x] Calcul côté serveur à l'enregistrement, validation directe (sans approbation)
- [x] Saisie « Nouveau bulletin » avec aperçu
- [x] PDF modèle FABS depuis les lignes enregistrées
- [ ] Déclarations CNPS/ITS depuis les lignes
- [x] IGR 2022 = calcul de 2024 ; cachet entreprise abandonné
- [x] Période des bulletins en français (« Octobre 2026 »), stockée et affichée
- [x] Centre d'approbations retiré, 2 retours en attente approuvés
## Matricule employés EP-01
- [x] Base : génération EP-01…, 7 employés renumérotés, contraintes
- [ ] Formulaire employé (champ en lecture seule), page Employés, texte de confirmation
- [ ] Tests du nouveau format

- [ ] Sécurité : ajouter un contrôle de droit aux 12 fonctions signalées par le test RLS n°11 (dont paie_enregistrer_bulletin)
- [ ] Sécurité : tables hors migrations (backup_cron_config, signature_keys…) — attend validation après lecture des politiques
- [ ] Test retours-integration : « permission denied for has_permission_v2 »

## Refonte visuelle Admin Dashboard V2 (5 nov.)
- [x] Lot 1 : palette bleu nuit / pétrole / bleu clair, cartes ombrées, mode sombre
- [ ] Lot 2 : barre latérale et barre du haut
- [ ] Lot 3 : tableau de bord
- [ ] Lot 4 : vérification module par module (connexion de l'aperçu nécessaire)

- [x] Menu : ancien menu sombre rétabli à la demande
- [x] Rapport d'exercice : achats comptés seulement si reçus ou payés (même règle que le Comparatif)
- [x] Nouveau style : Rôles et droits, Santé du système, Qualité des données
