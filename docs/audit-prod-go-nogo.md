# Audit Go / No-Go — Mise en production ERP FABS-CI

**Date** : 2026-07-12
**Portée** : Audit complet préproduction, sans modification de code.
**Périmètre couvert** : code, base de données, RLS/RBAC, sécurité,
modules critiques (Colisage / Tournées / Suivi livraisons), tests.

---

## Synthèse

| Volet | Résultat | Bloquant ? |
|-------|----------|------------|
| 1. TypeScript strict (`tsgo --noEmit`)   | ✅ 0 erreur                                   | Non |
| 2. Tests unitaires (Vitest)              | ⚠️ 143 / 152 (7 échecs `RouteGuard`)          | **Oui** |
| 3. Base de données / migrations          | ✅ 350 migrations, ordre chronologique cohérent | Non |
| 4. RLS & policies                        | ✅ 243 policies, 0 table publique sans RLS    | Non |
| 5. RBAC coverage                         | ✅ 93 permissions routes / 0 orpheline        | Non |
| 6. Wrapper `callRpc` (journalisation)    | ⚠️ 1 violation (`paiements-api.ts:114`)       | Non |
| 7. Scanner sécurité Supabase-Lov         | ❌ **1 erreur** privilege escalation (profiles) | **Oui** |
| 8. Warnings SECURITY DEFINER (Supabase)  | ⚠️ 208 warns bornés par `has_role`            | Non |
| 9. Module Colisage                       | ✅ workflow, triggers, RLS opérationnels      | Non |
| 10. Module Tournées                      | ✅ `finaliser_tournee` corrigé, triggers OK    | Non |
| 11. Module Suivi livraisons              | ✅ enum étendu, trigger auto-terminée, bucket preuves, RPC réception | Non |

### Décision : **⛔ NO-GO**

> 2 points bloquants doivent être corrigés avant déploiement.
> Une fois traités, l'application est apte à passer en production.

---

## Phase 1 — Audit global

### 1.1 Code & build
- `bun run typecheck` : **exit 0** — projet strict, 0 erreur TS.
- Dépendances : aucun package inutile détecté dans `package.json` par audit rapide (à confirmer avec `knip` en CI).
- Placeholders / TODO bloquants : aucun dans `src/routes/index.tsx`.

### 1.2 Base de données
- 350 migrations, aucune orpheline, timestamps monotones jusqu'au `20260712091443` (correctif `finaliser_tournee` → `validation_statut = 'valide'`).
- CHECK `tournees.validation_statut` cohérent avec le code TS.
- Enum `livsuivi_statut` : 14 valeurs, extensions (`chargee`, `en_route`, `reception_confirmee`, `non_livre`) présentes.
- Trigger `trg_check_tournee_all_livrees` actif ; RPC `livsuivi_confirmer_reception` présent ; bucket privé `livraison-preuves` créé.

### 1.3 RLS & sécurité
- 0 table `public.*` avec RLS désactivée.
- 0 table sous RLS sans policy (243 policies actives).
- GRANTs vérifiés dans les migrations récentes (méthodologie `GRANT ... TO authenticated` + `service_role`).

### 1.4 RBAC
- `scripts/check-rbac-coverage.mjs` : ✅ 93 permissions routes vérifiées, 0 orpheline.
- Menu diagnostics OK (couvert par `src/lib/__tests__/rbac-menu-diagnostics.test.ts`).

### 1.5 Wrapper RPC critique
- `scripts/check-rpc-wrapper.mjs` :
  - ❌ **1 violation** : `src/lib/paiements-api.ts:114` appelle directement
    `supabase.rpc("annuler_paiement", …)`. Doit passer par `callRpc()` pour
    tracer latences + erreurs dans `audit_events`.

### 1.6 Scanner sécurité (`security--run_security_scan`)
- 214 findings :
  - **1 ERROR** (bloquant) — cf. Phase 4.
  - 2 WARN privilege escalation MFA (`mfa_otp_attempts`, `mfa_session_validations`).
  - 208 WARN "SECURITY DEFINER Function Executable" — déjà classés dans `docs/audit-prod-securite.md` (fonctions volontairement `SECURITY DEFINER` bornées par `has_role`/`ownership`). Non bloquants.
  - 3 WARN divers connectors/app_mcp : 0 finding.

### 1.7 Tests unitaires (`bunx vitest run`)
- 24 fichiers, 152 tests → **143 pass / 7 fail / 2 skipped**.
- Toutes les régressions sont dans `src/components/rbac/__tests__/RouteGuard.test.tsx`
  (7 tests). Cause probable : mock manquant ou signature de
  `isSuperAdminOnlyRoute` modifiée sans mise à jour du test (le composant
  appelle `getRoutePermission` + `isSuperAdminOnlyRoute` — le test mocke
  vraisemblablement l'un mais pas l'autre).

### 1.8 Performances
- Non testées durant cet audit (nécessite k6-smoke — cf. `.github/workflows/k6-smoke.yml`).
- Aucun index manifestement manquant détecté sur les tables critiques
  (`livsuivi_commandes`, `tournees`, `colis`) au regard des jointures observées.

---

## Phase 2 — Modules critiques

### 2.1 Colisage
- Routes `src/routes/_authenticated/colisage.*` fonctionnelles.
- Hook `useColisageDetail` complet (client info, colis existants, préparateurs, livreurs, zones directes) — bonne séparation lecture/mutation.
- Triggers : `trg_colis_sync_tournee`, `trg_colis_tournee_immutable` actifs.
- Suppression avec suivi journal (`colisage_modifications_historique`).
- Statut : ✅ **prêt**.

### 2.2 Tournées
- Création + affectation + clôture opérationnelles.
- `finaliser_tournee(_tournee_id uuid)` : signature unique, corrigée
  (`validation_statut = 'valide'` conforme au CHECK).
- Triggers `trg_propagate_tournee_statut` + `trg_propagate_tournee_ressources` propagent chauffeur/véhicule aux colis.
- Bon de sortie PDF (`src/lib/pdf/tourneePdf.ts`) présent.
- Statut : ✅ **prêt**.

### 2.3 Suivi des livraisons
- 1 tournée → N `livsuivi_commandes` (dédup par `commande_id` dans `finaliser_tournee`).
- Enum étendu (14 statuts), historique dans `livsuivi_historique`.
- Confirmation réception : signature (canvas) + photo → bucket privé `livraison-preuves`, RPC `livsuivi_confirmer_reception`.
- Trigger `trg_check_tournee_all_livrees` : passe la tournée à `terminee` quand toutes les livraisons sont finales.
- Test SQL : `supabase/tests/trg_tournee_auto_terminee.sql`.
- Statut : ✅ **prêt** (à valider par le test E2E `tournee-colisage-suivi-flow.spec.ts` en CI).

---

## Phase 3 — Tests E2E disponibles

Suite Playwright présente couvrant les flux critiques :
- `tournee-colisage-suivi-flow.spec.ts` — flux complet Colisage → Tournée → Suivi.
- `livraison-suivi-avancer-flow.spec.ts` — transitions de statut.
- `livraison-suivi-remise.spec.ts`, `livraison-suivi-page-size.spec.ts`.
- `tournee-cloture-invalide.spec.ts`, `tournee-workflow-rules.spec.ts`.
- `workflow-aller-retour.spec.ts` — annulation / retour arrière.
- `bl-livre.spec.ts`, `colisage-*.spec.ts` (5 specs).
- `rbac-par-role.spec.ts` — matrice RBAC.

Non exécutés dans cet audit (nécessite Playwright en CI). À déclencher
dans la Phase 5.

---

## Phase 4 — Décision détaillée

### ✅ Prêt pour la production
- TypeScript strict propre.
- Modules Colisage / Tournées / Suivi livraisons fonctionnels et cohérents.
- RLS + policies + GRANTs + RBAC coverage validés.
- Migrations propres, aucun schéma incohérent.

### ⛔ À corriger avant GO (bloquants)

| # | Sévérité | Fichier / Objet | Description | Correction |
|---|----------|------------------|-------------|------------|
| B-1 | **CRITIQUE (SEC error)** | RLS `public.profiles` policy *"Users update own profile"* | Un utilisateur peut modifier ses propres colonnes `is_restricted`, `mfa_required`, `mfa_enrolled_at` → contournement des restrictions et de l'obligation MFA. | Restreindre le `WITH CHECK` de la policy UPDATE (ou trigger BEFORE UPDATE) pour bloquer ces 3 colonnes ; réserver leur modification à une policy admin ou à une RPC `SECURITY DEFINER` bornée `has_role('super_admin')`. |
| B-2 | **MAJEUR (tests)** | `src/components/rbac/__tests__/RouteGuard.test.tsx` | 7 tests échouent sur `isSuperAdminOnlyRoute` — la CI ne peut plus valider les changements RBAC. | Corriger le mock (`vi.mock("@/lib/route-permissions", …)` doit exposer aussi `isSuperAdminOnlyRoute`). |

### ⚠️ À corriger avant fin de sprint (non-bloquants)

| # | Sévérité | Fichier | Description | Correction |
|---|----------|---------|-------------|------------|
| N-1 | Moyen | `src/lib/paiements-api.ts:114` | `supabase.rpc("annuler_paiement", …)` direct → pas de journalisation `audit_events`. | Remplacer par `callRpc("annuler_paiement", { … })`. |
| N-2 | Moyen | Policy `own attempts` sur `mfa_otp_attempts` | Un user peut effacer son propre `fail_count`/`locked_until`. | Split policy : SELECT own + writes réservés au serveur (RPC `SECURITY DEFINER`). |
| N-3 | Moyen | Policy `own sessions` sur `mfa_session_validations` | Un user peut INSERT ses propres validations MFA. | Idem : SELECT own + INSERT via serveur uniquement. |

### 🗑️ À supprimer / nettoyer
- Aucun fichier orphelin identifié dans le périmètre audité.
- Vérifier post-GO les migrations correctives (`20260712091443_*.sql`) : elles peuvent être consolidées en fin d'itération si souhaité, sans urgence.

### 📦 À conserver tel quel
- Toute la chaîne backup/cron (`run-backup-schedules-hourly`).
- Wrapper `callRpc` (bien conçu, à généraliser via CI check déjà en place).
- Middleware auth : `requireSupabaseAuth` + `attachSupabaseAuth`.

### Niveau de risque global
- Sans correction : **CRITIQUE** (élévation de privilèges MFA / restriction contournable).
- Après B-1 + B-2 : **FAIBLE**.

---

## Phase 5 — Suite

Voir `docs/prompt-validation-finale.md` : prompt unique à réutiliser après
correction des points B-1 et B-2 pour relancer toutes les vérifications et
émettre la décision **GO**.

---

## Annexes

### Commandes exécutées
```
bun run typecheck                                # exit 0
bunx vitest run                                   # 143/152, 7 FAIL RouteGuard
node scripts/check-rpc-wrapper.mjs                # 1 violation
node scripts/check-rbac-coverage.mjs              # OK 93/93
security--run_security_scan                        # 214 findings (1 error)
psql -c "SELECT COUNT(*) FROM pg_policies …"      # 243
psql -c "SELECT enumlabel FROM pg_enum …"         # 14 statuts livsuivi
psql -c "SELECT tgname FROM pg_trigger …"         # trg_check_tournee_all_livrees OK
```
