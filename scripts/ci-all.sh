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

if [ "${SKIP_RLS:-0}" = "1" ]; then
  echo "▶ Tests RLS: SKIP volontaire (SKIP_RLS=1)"
elif [ -n "${PGHOST:-}" ]; then
  echo "▶ Tests RLS (psql)"
  psql -v ON_ERROR_STOP=1 -f scripts/test-rls-audit.sql 2>&1 | tee /tmp/rls-report.txt
  if grep -Ei "^FAIL|EXCEPTION|ERROR:" /tmp/rls-report.txt; then
    echo "❌ Tests RLS en échec"
    exit 1
  fi
else
  echo "❌ Tests RLS impossibles : PGHOST non défini."
  echo "   Définissez PGHOST (et PGUSER/PGPASSWORD/PGDATABASE) ou relancez avec SKIP_RLS=1 pour les sauter volontairement."
  exit 1
fi

if [ "${E2E:-0}" = "1" ]; then
  echo "▶ Tests e2e Playwright"
  python3 e2e/paiements_flow.py
else
  echo "▶ E2E: SKIP (relancer avec E2E=1)"
fi

echo "✅ Suite CI terminée avec succès"