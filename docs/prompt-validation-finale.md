# Prompt — Validation finale de mise en production

> À exécuter uniquement après correction des points **B-1** (privilege
> escalation `profiles`) et **B-2** (mocks RouteGuard) listés dans
> `docs/audit-prod-go-nogo.md`.
>
> Ne pas déployer avant que ce prompt ait rendu la décision **GO**.

---

## Prompt à envoyer à l'IA de développement

```
Validation finale de mise en production — ERP FABS-CI

Contexte : l'audit Go/No-Go (docs/audit-prod-go-nogo.md) a été traité
et tous les correctifs bloquants (B-1, B-2) sont censés être en place.
Ne pas déployer avant d'avoir obtenu la décision GO à la fin de ce
prompt.

Objectif : relancer automatiquement toutes les vérifications critiques
et confirmer que l'application est prête pour la production.

Contraintes :
- Aucune modification de code pendant les vérifications.
- Toute erreur critique → décision NO-GO, publier la liste des
  correctifs à appliquer, ne pas déployer.
- Toute sortie bruyante redirigée vers /tmp/validation/*.log.

Étapes obligatoires (dans cet ordre, résultats consolidés à la fin) :

1. Build & typecheck
   - bun run typecheck                → attendu : exit 0

2. Tests unitaires
   - bunx vitest run                   → attendu : 0 échec
   - Vérifier notamment src/components/rbac/__tests__/RouteGuard.test.tsx

3. Base de données & RLS
   - supabase--linter                  → 0 erreur bloquante
   - psql : 0 table public sans RLS, 0 table sous RLS sans policy
   - Vérifier que la policy UPDATE de public.profiles interdit la
     modification des colonnes is_restricted, mfa_required,
     mfa_enrolled_at par un utilisateur non-admin (B-1).

4. Sécurité
   - security--run_security_scan       → 0 finding level="error"
   - Confirmer que les 2 warns MFA (mfa_otp_attempts,
     mfa_session_validations) sont soit corrigés soit acceptés au
     niveau du security-memory.

5. RBAC & wrapper RPC
   - node scripts/check-rbac-coverage.mjs   → OK, 0 orpheline
   - node scripts/check-rpc-wrapper.mjs     → 0 violation

6. Modules critiques (E2E Playwright)
   - npx playwright test e2e/tournee-colisage-suivi-flow.spec.ts
   - npx playwright test e2e/livraison-suivi-avancer-flow.spec.ts
   - npx playwright test e2e/workflow-aller-retour.spec.ts
   - npx playwright test e2e/rbac-par-role.spec.ts
   → attendu : 100 % pass

7. Vérifications DB spécifiques (psql)
   - Enum livsuivi_statut contient : preparee, chargee, en_route,
     arrive_client, livree, reception_confirmee, non_livre,
     livree_locale (minimum).
   - Trigger trg_check_tournee_all_livrees actif sur livsuivi_commandes.
   - RPC public.finaliser_tournee(_tournee_id uuid) présente et
     positionne validation_statut = 'valide'.
   - RPC public.livsuivi_confirmer_reception présente.
   - Bucket storage.buckets id='livraison-preuves' privé.

8. Performances (smoke)
   - Optionnel mais recommandé : k6 smoke (.github/workflows/k6-smoke.yml)
     → p95 < 800 ms sur /api/public/hooks/*.

Décision finale :
- GO si et seulement si chacune des 7 vérifications obligatoires (1-7)
  est verte, aucune erreur critique n'a été détectée, et B-1/B-2 sont
  fermés.
- Sinon NO-GO : lister explicitement les vérifications rouges et
  les correctifs requis.

Produire un rapport final :
  docs/validation-finale-prod.md
contenant le tableau récap (étape / résultat / preuve), la décision
et l'horodatage.

Si GO : le déploiement peut être lancé via le bouton Publier de
Lovable (ou l'action <presentation-open-publish/>).
```

---

## Références
- Audit détaillé : `docs/audit-prod-go-nogo.md`
- Historique audits antérieurs : `docs/audit-prod-final.md`,
  `docs/audit-prod-securite.md`, `docs/audit-prod-fonctionnel.md`,
  `docs/audit-prod-backup.md`.
