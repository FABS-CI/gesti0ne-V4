import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { CHARTE_HEX, isZebraRow } from "./charte-documents";

describe("charte des documents FABS-CI", () => {
  it("garde les couleurs demandées", () => {
    expect(CHARTE_HEX.titre).toBe("#E9530D");
    expect(CHARTE_HEX.enTete).toBe("#2563EB");
    expect(CHARTE_HEX.zebra).toBe("#EAF2FF");
    expect(CHARTE_HEX.contour).toBe("#173B78");
    expect(CHARTE_HEX.traitInterne).toBe("#A8BFE3");
    expect(CHARTE_HEX.totalFond).toBe("#2563EB");
    expect(CHARTE_HEX.payeFond).toBe("#F3F4F6");
    expect(CHARTE_HEX.resteFond).toBe("#E9530D");
    expect(CHARTE_HEX.resteTexte).toBe("#FFFFFF");
  });
  it("zèbre une ligne sur deux selon l'indice global", () => {
    expect([0, 1, 2, 3].map(isZebraRow)).toEqual([false, true, false, true]);
  });
  it("aucun autre fichier PDF ne redéfinit une couleur de la charte", () => {
    const dir = __dirname;
    const hexes = Object.values(CHARTE_HEX).filter((h) => h !== "#FFFFFF" && h !== "#000000");
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".ts") || f.startsWith("charte-documents") || f.endsWith(".test.ts") || f === "recap-themes.ts") continue; // recap-themes : catalogue des anciens thèmes réglables
      const src = readFileSync(join(dir, f), "utf8").toUpperCase();
      for (const h of hexes) expect(src.includes(h), `${f} contient ${h}`).toBe(false);
    }
  });
});
