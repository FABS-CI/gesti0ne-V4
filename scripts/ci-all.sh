#!/usr/bin/env bash
# Suite complète: typecheck + tests unitaires + tests RLS + (option) e2e.
#
# Usage:
#   bash scripts/ci-all.sh              # typecheck + vitest + RLS
#   E2E=1 bash scripts/ci-all.sh        # inclut les tests Playwright
#
# Variables optionnelles pour l'e2e:
#   E2E_CLIENT_ID           uuid d'un client de test
#   LOVABLE_BROWSER_*       injectées par la sandbox Lovable
set -euo pipefail

echo "▶ Typecheck (tsgo)"
bun run typecheck

echo "▶ Tests unitaires (vitest)"
bunx vitest run

if [ -n "${PGHOST:-}" ]; then
  echo "▶ Tests RLS (psql)"
  psql -f scripts/test-rls-audit.sql
else
  echo "▶ Tests RLS: SKIP (PGHOST non défini)"
fi

if [ "${E2E:-0}" = "1" ]; then
  echo "▶ Tests e2e Playwright"
  python3 e2e/paiements_flow.py
else
  echo "▶ E2E: SKIP (relancer avec E2E=1)"
fi

echo "✅ Suite CI terminée avec succès"