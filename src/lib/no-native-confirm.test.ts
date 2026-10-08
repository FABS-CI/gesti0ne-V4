import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { inferConfirmLabel } from "@/components/common/GlobalConfirm";

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p) && !p.includes(".test.")) out.push(p);
  }
  return out;
}
const NATIVE = /(?<![\w.])(?<!await )(window\.)?(confirm|alert)\(/;

describe("confirmations", () => {
  it("aucun confirm()/alert() natif", () => {
    const files = [...walk("src/components"), ...walk("src/routes")];
    expect(files.filter((f) => NATIVE.test(readFileSync(f, "utf8")))).toEqual([]);
  });
  it("le bouton porte le nom de l'action, jamais OK", () => {
    expect(inferConfirmLabel("Supprimer l'inventaire INV-1 ?")).toBe("Supprimer");
    expect(inferConfirmLabel("Recalculer et corriger 3 anomalie(s) ?")).toBe("Recalculer");
    expect(inferConfirmLabel("Voulez-vous poursuivre ?")).toBe("Confirmer");
  });
});
