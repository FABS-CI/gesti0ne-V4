# ERP Éditions FABS

Application ERP construite sur TanStack Start + Lovable Cloud (Supabase).

## Développement

```bash
bun install
bun run dev
```

## Tests

Suite complète (typecheck + unitaires + RLS) :

```bash
bash scripts/ci-all.sh
```

### Individuellement

| Commande | Ce que ça vérifie |
| --- | --- |
| `bun run typecheck` | Typecheck TS strict (tsgo, paquet `@typescript/native-preview`) |
| `bunx vitest run` | Tests unitaires (récap paiement, meta PDF comparatif, RouteGuard, validations…) |
| `psql -f scripts/test-rls-audit.sql` | Policies RLS + RPC `annuler_paiement` (admin only) |
| `E2E=1 bash scripts/ci-all.sh` | Ajoute les tests Playwright (`e2e/paiements_flow.py`) |

### Tests e2e Playwright

Voir `e2e/README.md`. Nécessite une session Lovable managée (`LOVABLE_BROWSER_AUTH_STATUS=injected`) et un `E2E_CLIENT_ID` valide.

## Structure clef

- `src/routes/` — routes TanStack (file-based)
- `src/lib/` — logique pure testable (`paiement-recap.ts`, `pdf-comparatif.ts`)
- `src/integrations/supabase/` — clients auto-générés (ne pas éditer)
- `supabase/migrations/` — migrations SQL versionnées
- `scripts/` — scripts CI, tests RLS
- `e2e/` — flux Playwright bout-en-bout

## Audit final avant production

Se référer aux plans archivés dans `.lovable/plan/` et au prompt d'audit fonctionnel complet (modules, workflows, PDF, droits, performances, UX). L'audit ERP complet dépasse le périmètre d'un commit : le décomposer en lots (par module) pour un traitement itératif.