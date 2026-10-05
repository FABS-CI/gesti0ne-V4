#!/usr/bin/env bash
# Audit dédié: Facturation → Paiements → Comptes clients.
# Exécute le typecheck, les tests unitaires ciblés (récap, workflow, PDF),
# et — si PGHOST est défini — les vérifs RLS liées à l'annulation.
set -euo pipefail

echo "▶ [1/3] Typecheck"
bun run typecheck

echo "▶ [2/3] Tests unitaires du workflow Facturation → Paiements → Comptes clients"
bunx vitest run \
  src/lib/paiement-recap.test.ts \
  src/lib/facturation-workflow.test.ts \
  src/lib/pdf-comparatif.test.ts

if [ -n "${PGHOST:-}" ]; then
  echo "▶ [3/3] Tests RLS annulation de paiement"
  psql -f scripts/test-rls-audit.sql
else
  echo "▶ [3/3] Tests RLS: SKIP (PGHOST non défini)"
fi

echo "✅ Audit workflow Facturation → Paiements → Comptes clients OK"
