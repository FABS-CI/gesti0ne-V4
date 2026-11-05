import { describe, expect, it } from "vitest";
import { retourLineAmounts, retourOriginReference } from "./retour-document-data";

describe("return invoice terms", () => {
  it("RET-261104-001: 100 at 3000 with 25% global discount equals 225000", () => {
    expect(retourLineAmounts({ prix: 3000, quantite: 100, remisePct: 0, remiseGlobalePct: 25, totalLigne: 300000, remiseMontant: 0 }))
      .toMatchObject({ brut: 300000, net: 225000, remiseEffectivePct: 25, remiseEffectiveMontant: 75000 });
  });
  it("combines line and global discounts once, retaining fractional francs", () => {
    const amounts = retourLineAmounts({ prix: 101, quantite: 3, remisePct: 10, remiseGlobalePct: 25 });
    expect(amounts.net).toBeCloseTo(204.525, 8);
    expect(amounts.remiseEffectivePct).toBeCloseTo(32.5, 8);
  });
  it("preserves stored line valuation rather than recomputing historical amounts", () => {
    expect(retourLineAmounts({ prix: 100, quantite: 3, remisePct: 0, remiseGlobalePct: 0, totalLigne: 275 }).net).toBe(275);
  });
  it("removes command and delivery padding without changing invoice or return numbering", () => {
    expect(retourOriginReference("CMD-2026-00082")).toBe("CMD-2026-82");
    expect(retourOriginReference("BL-2026-00082")).toBe("BL-2026-82");
    expect(retourOriginReference("FAC-2026-00082")).toBe("FAC-2026-00082");
    expect(retourOriginReference("RET-261104-001")).toBe("RET-261104-001");
  });
});