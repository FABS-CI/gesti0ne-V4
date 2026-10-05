# 11 — Runbook Sauvegarde & Restauration (§14)

> Document **hors ERP** : à imprimer / stocker dans Google Drive et sur un poste local.
> Il doit rester utilisable même si l'application est totalement indisponible.

Version : 1.0 — Responsable : Direction SI FABS-CI

---

## 1. Ce qui est sauvegardé

| Élément | Contenu | Emplacement | Fréquence |
|---|---|---|---|
| **Archive globale ZIP** | Données métier (toutes les tables) + comptes utilisateurs + fichiers stockés (binaires) + configuration technique (politiques d'accès, fonctions, triggers, extensions) + manifeste SHA-256 | Google Drive `/DONNEE GESTI-ONE/` | **Toutes les 3 heures** (30 archives conservées) |
| Export JSON métier | Toutes les tables applicatives (clients, produits, commandes, factures, paiements, stocks, retours, RH…) | Google Drive (connecteur) + téléchargement local | Quotidienne (planifiée) |
| Export ZIP complet | JSON métier + schéma SQL + fichiers de configuration | Google Drive `/FABS-CI/backups/` | Hebdomadaire |
| Code source | Dépôt GitHub du projet | GitHub | À chaque modification |
| Secrets / variables | `docs/deployment/06-variables-environnement.md` (liste), valeurs dans le gestionnaire de mots de passe | Coffre-fort | À chaque rotation |

**Règle 3-2-1** : 3 copies, 2 supports différents (Drive + poste local), 1 hors ligne (disque chiffré trimestriel).

### 1.1 Archive globale — déclenchement

- **Manuel** : Paramètres → Sauvegarde → « Créer l'archive globale maintenant » (super_admin).
- **Automatique** : tâche planifiée `erp-global-backup-3h` toutes les 3 heures
  `POST https://project--<id>.lovable.app/api/public/backup/cron`
  avec l'en-tête `x-backup-secret` (secret unique, lu côté serveur).
  L'ancienne adresse `/api/public/hooks/global-backup` exécute la même chaîne avec le même secret.
- **Rotation** : les 30 archives les plus récentes sont conservées, les plus anciennes sont supprimées du Drive.
- **Journalisation** : chaque exécution crée une ligne dans l'historique des sauvegardes (durée, taille, nombre de tables/enregistrements, SHA-256, lien Drive, statut).

### 1.2 Contenu de l'archive

```text
fabsci_sauvegarde_globale_AAAA-MM-JJTHH-MM-SS.zip
├── MANIFEST.json          inventaire, empreintes, contexte d'exécution
├── LISEZ-MOI.txt          mode d'emploi de restauration
├── data/<table>.json      toutes les tables métier
├── auth/users.json        comptes (sans mots de passe — non exportables)
├── storage/<bucket>/…     fichiers réels (≤ 15 Mo/fichier, 120 Mo au total)
├── storage/_manifest.json inventaire complet + URLs signées 7 jours pour le reste
└── config/config_snapshot.json  politiques RLS, fonctions, triggers, extensions
```


---

## 2. Procédure de sauvegarde manuelle (5 min)

1. Se connecter à l'ERP avec un compte **super_admin**.
2. Menu **Paramètres → Sauvegarde & Restauration**.
3. Cliquer **Créer une sauvegarde maintenant (JSON)**.
4. Vérifier que la case **Envoyer aussi vers Google Drive** est cochée (connecteur atelier).
5. Attendre le message de confirmation puis **Télécharger** le fichier sur le poste local.
6. Renommer : `fabsci-backup-AAAA-MM-JJ.json` et déposer dans `Drive/FABS-CI/backups/AAAA/`.
7. Noter la ligne dans le registre (§6).

En cas d'échec : consulter `docs/runbook-incidents.md` puis relancer. Ne jamais clôturer la journée sans une sauvegarde valide.

---

## 3. Procédure de restauration (hors ERP)

> Objectif : reconstituer l'ERP sur un environnement neuf.
> Détail technique complet : `docs/deployment/10-restauration-complete.md`.

### Étapes

1. **Préparer l'environnement** — nouveau projet backend + nouveau déploiement frontend (`01-checklist.md`).
2. **Restaurer le code** — cloner le dépôt GitHub, brancher les variables d'environnement (`06-variables-environnement.md`).
3. **Restaurer le schéma** — rejouer les migrations SQL du dépôt dans l'ordre (`04-supabase-migration.md`).
4. **Restaurer les données** — importer le dernier export JSON dans l'ordre des dépendances :
   `depots → categories → produits → fournisseurs → clients → commandes → factures → paiements → stocks → retours → RH`.
5. **Restaurer les comptes** — recréer les utilisateurs, réaffecter rôles et permissions RBAC v2.
6. **Vérifier l'authentification** — connexion super_admin, MFA, OAuth (`07-auth-oauth.md`).
7. **Rebrancher le domaine** — DNS et certificat (`08-domaine-dns.md`).
8. **Contrôles post-restauration** (`09-post-migration.md`).

### Contrôles de conformité obligatoires

- [ ] Nombre de clients identique à la source
- [ ] Nombre de produits identique à la source
- [ ] Somme des factures TTC identique (± 0 FCFA)
- [ ] Somme des paiements identique
- [ ] Stock total par dépôt identique
- [ ] Dernière référence de chaque séquence (FAC, CMD, FRS, BL) cohérente
- [ ] Connexion possible pour chacun des rôles (commercial, magasinier, comptable, admin)

**RTO cible : 4 h — RPO cible : 24 h.**

---

## 4. Test de restauration réel — journal

Chaque test se fait sur un environnement **jetable**, jamais sur la production.

| Date | Sauvegarde testée | Durée | Résultat | Écarts constatés | Opérateur |
|---|---|---|---|---|---|
| _à compléter_ | | | | | |

### Protocole du test (2 h)

1. Créer un projet backend temporaire et un déploiement frontend de test.
2. Dérouler intégralement le §3 en chronométrant chaque étape.
3. Exécuter les contrôles de conformité et consigner les écarts.
4. Corriger la documentation si une étape s'est révélée floue ou incomplète.
5. **Détruire l'environnement de test** et supprimer les copies de données.
6. Compléter la ligne du journal ci-dessus et informer la direction.

---

## 5. Planification trimestrielle

| Trimestre | Période cible | Responsable | Statut |
|---|---|---|---|
| T1 | Mars | Direction SI | à planifier |
| T2 | Juin | Direction SI | à planifier |
| T3 | Septembre | Direction SI | à planifier |
| T4 | Décembre | Direction SI | à planifier |

Rappels : créer un événement récurrent trimestriel dans l'agenda de l'équipe SI, avec 2 semaines de préavis.
Un trimestre sans test réalisé doit être remonté en comité de direction.

---

## 6. Registre des sauvegardes

| Date | Type (JSON / ZIP) | Taille | Drive | Local | Vérifié par |
|---|---|---|---|---|---|
| _à compléter_ | | | | | |

---

## 7. Contacts d'escalade

| Rôle | Nom | Contact | Quand l'appeler |
|---|---|---|---|
| Responsable SI | _à compléter_ | | Toute perte de données |
| Référent ERP métier | _à compléter_ | | Écart de données après restauration |
| Support hébergement | _à compléter_ | | Indisponibilité plateforme > 1 h |
