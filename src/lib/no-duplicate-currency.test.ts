import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Garde-fou de la règle « la devise apparaît une seule fois » (voir `formatFCFA`
// dans src/lib/format.ts). Chaque contrôle renvoie les lignes fautives
// « fichier:ligne » pour que l'échec dise exactement quoi corriger.

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

const files = walk("src");

function offending(test: (line: string) => boolean): string[] {
  const hits: string[] = [];
  for (const f of files) {
    readFileSync(f, "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (test(line)) hits.push(`${f}:${i + 1}`);
      });
  }
  return hits;
}

describe("devise FCFA affichée une seule fois", () => {
  it("pas de « FCFA » ajouté à la main après un montant formaté", () => {
    // formatFCFA(x, false) + " FCFA" ou formatNumber(x) + " FCFA" : utiliser formatFCFA(x).
    const manuel = /(false\)|formatNumber\([^)]*\)\)?)\}?\s*F ?CFA/;
    expect(offending((l) => manuel.test(l))).toEqual([]);
  });

  it("pas de libellé « (FCFA) » à côté d'un montant déjà suffixé", () => {
    // { label: "Total (FCFA)", value: formatFCFA(x) } affiche « Total (FCFA) : 1 000 FCFA ».
    expect(
      offending((l) => /\(F ?CFA\)/.test(l) && /formatFCFA\(/.test(l) && !/,\s*false\)/.test(l)),
    ).toEqual([]);
  });

  it("pas de total de document libellé « (FCFA) »", () => {
    // Le montant du bandeau est toujours formaté avec la devise (« TOTAL À PAYER : 232 012 FCFA »).
    expect(offending((l) => /["'`]TOTAL[^"'`]*\(F ?CFA\)/.test(l))).toEqual([]);
  });
});
