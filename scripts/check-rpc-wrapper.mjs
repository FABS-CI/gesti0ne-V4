#!/usr/bin/env node
/**
 * Bloque l'usage direct de `supabase.rpc("<nom>", …)` pour une liste de RPC
 * critiques. Ces RPC doivent passer par le wrapper `callRpc()` de src/lib/rpc.ts
 * afin de bénéficier de la journalisation d'échecs + latences dans audit_events
 * (visible sur /admin/rpc-errors).
 *
 * Exit != 0 si une violation est trouvée. Ignorer ponctuellement une ligne :
 *   // rpc-wrapper-allow
 */
import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import { execSync } from "node:child_process";

const CRITICAL_RPCS = [
  "creer_commande",
  "annuler_paiement",
  "enregistrer_paiement",
  "creer_retour",
  "creer_specimen",
  "creer_incident_stock",
  "ajuster_stock_depot",
  "confirmer_achat",
  "enregistrer_approvisionnement",
  "creer_colisage",
  "creer_colisage_manuel",
  "annuler_colisage",
  "annuler_incident",
  "annuler_inventaire",
  "annuler_retour",
  "annuler_specimen",
  "annuler_transfert",
  "executer_cloture_exercice",
  "ajouter_note_document",
];

const files = execSync(
  `git ls-files 'src/**/*.ts' 'src/**/*.tsx' ':!src/lib/rpc.ts' ':!src/integrations/supabase/**'`,
  { encoding: "utf8" },
)
  .split("\n")
  .filter(Boolean);

const violations = [];
const rpcPattern = new RegExp(
  String.raw`supabase\s*\.\s*rpc\s*\(\s*['"\`](` + CRITICAL_RPCS.join("|") + String.raw`)['"\`]`,
  "g",
);

for (const file of files) {
  const src = readFileSync(file, "utf8");
  const lines = src.split("\n");
  lines.forEach((line, idx) => {
    if (line.includes("rpc-wrapper-allow")) return;
    const m = rpcPattern.exec(line);
    rpcPattern.lastIndex = 0;
    if (m) {
      violations.push({ file, line: idx + 1, rpc: m[1], code: line.trim() });
    }
  });
}

if (violations.length > 0) {
  console.error("\n❌ Usage direct de supabase.rpc sur des RPC critiques détecté :\n");
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  rpc="${v.rpc}"`);
    console.error(`    → ${v.code}`);
  }
  console.error(
    `\n${violations.length} violation(s). Utilise callRpc("<nom>", args) depuis @/lib/rpc.\n` +
      `Ou ajoute // rpc-wrapper-allow en fin de ligne pour un cas exceptionnel.\n`,
  );
  process.exit(1);
}

console.log(`✅ Wrapper callRpc respecté (${CRITICAL_RPCS.length} RPC critiques surveillées).`);