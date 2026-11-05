// Charte graphique des documents commerciaux FABS-CI : couleurs figées et
// appliquées par le moteur commun (base-document.ts), jamais redéfinies ailleurs.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHARTE_HEX } from "./charte-documents";
import { RECAP_THEMES, DEFAULT_RECAP_THEME } from "./recap-themes";

const lire = (f: string) => readFileSync(`src/lib/pdf/${f}`, "utf8");

describe("charte des documents FABS-CI", () => {
  it("couleurs officielles", () => {
    expect(CHARTE_HEX).toMatchObject({
      orange: "#E9530D",
      bleu: "#2563EB",
      zebre: "#EAF2FF",
      bordureExterieure: "#173B78",
      traitInterne: "#A8BFE3",
    });
  });

  it("le thème du récap par défaut suit la charte", () => {
    const t = RECAP_THEMES[DEFAULT_RECAP_THEME].hex;
    expect(t.total).toBe(CHARTE_HEX.bleu);
    expect(t.fond).toBe(CHARTE_HEX.zebre);
    expect(t.filet).toBe(CHARTE_HEX.traitInterne);
    expect(t.bordure).toBe(CHARTE_HEX.bordureExterieure);
  });

  it("moteur commun : titre orange, en-tête bleu, zébrage, contour, reste à payer orange", () => {
    const src = lire("base-document.ts");
    expect(src).toMatch(/size: titleSize,\s*font: this\.fonts\.bold,\s*color: CHARTE\.orange/);
    expect(src).toContain("height: 20, color: CHARTE.bleu");
    expect(src).toContain("color: CHARTE.zebre");
    expect(src).toContain("drawContourSegment(curY)");
    expect(src).toContain("fill: CHARTE.orange");
  });

  it("aucun ancien gris de tableau ni bloc arrondi gris dans les documents", () => {
    for (const f of [
      "base-document.ts",
      "receipt-document.ts",
      "statement-document.ts",
      "retour-document.ts",
    ]) {
      expect(lire(f), f).not.toMatch(/color: BODY\.grisClair, borderColor: BODY\.bord/);
    }
    expect(lire("base-document.ts")).not.toContain("color: BODY.ardoise });\n");
  });
});
