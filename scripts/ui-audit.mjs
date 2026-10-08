#!/usr/bin/env node
// Audit UI (refonte visuelle) : compte les signes d'interface à nettoyer dans src/.
// Informatif uniquement : ne fait jamais échouer la CI.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "src";
const SKIP = [/src[\\/]components[\\/]ui[\\/]/, /\.test\.tsx?$/, /__tests__/, /routeTree\.gen\.ts$/, /integrations[\\/]supabase/];

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|css)$/.test(n) && !SKIP.some((r) => r.test(p))) out.push(p);
  }
  return out;
}

const CHECKS = [
  ["<h1 brut", /<h1\b/g],
  ["Couleurs Tailwind brutes", /\b(?:text|bg|border|ring|from|to|via|fill|stroke)-(?:red|green|blue|amber|yellow|orange|emerald|slate|gray|zinc)-\d{2,3}\b/g],
  ["text-[9px|10px|11px]", /text-\[(?:9|10|11)px\]/g],
  ["Emojis / symboles", /[☐✓✗💾⚡🖨⚠🎉🚨✅]/gu, /\.tsx$/],
  ["Sparkles/Wand2/Bot", /\b(?:Sparkles|WandSparkles|Wand2|Bot)\b/g],
  ["Dégradés", /bg-gradient-|radial-gradient|linear-gradient/g],
  ["backdrop-blur", /backdrop-blur/g],
  ["shadow-lg/xl/2xl", /shadow-(?:lg|xl|2xl)\b/g],
  ["rounded-2xl/3xl", /rounded-(?:2xl|3xl)\b/g],
  ["toLocaleString/DateString", /toLocale(?:Date)?String\(/g],
  ['"FCFA" en dur', /FCFA/g],
  ["confirm( / alert( natifs", /(?<![\w.])(?:window\.)?(?:confirm|alert)\(/g],
  ["Messages génériques", /Une erreur est survenue|Impossible de/g],
];

const files = walk(ROOT);
const rows = CHECKS.map(([label, re, only]) => {
  let count = 0, nfiles = 0;
  for (const f of files) {
    if (only && !only.test(f)) continue;
    const m = readFileSync(f, "utf8").match(re);
    if (m) { count += m.length; nfiles++; }
  }
  return { Indicateur: label, Occurrences: count, Fichiers: nfiles };
});

console.log(`Audit UI — ${files.length} fichiers analysés (hors ui/, tests, fichiers générés)`);
console.table(rows);
process.exit(0);
