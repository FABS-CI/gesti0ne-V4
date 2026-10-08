import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Les écrans passent par src/lib/format.ts ; PDF, étiquettes et composants de base exclus.
const SKIP = /(pdf|etiquet|label|qr|print|\.test\.|components\/ui\/)/i;
const DIRECT = /\.toLocale(Date|Time)?String\(/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".tsx") && !SKIP.test(p)) out.push(p);
  }
  return out;
}

describe("mise en forme centralisée", () => {
  it("aucun toLocaleString / toLocaleDateString direct dans les écrans", () => {
    const files = [...walk("src/components"), ...walk("src/routes")];
    expect(files.filter((f) => DIRECT.test(readFileSync(f, "utf8")))).toEqual([]);
  });
});
