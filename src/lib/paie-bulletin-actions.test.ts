import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/pdf/fabsTemplates", () => ({ downloadBlob: vi.fn() }));
vi.mock("@/lib/pdf/bulletinPaieCI", () => ({
  generateBulletinPaieCIPDF: vi.fn(),
  bulletinFileName: vi.fn(),
  ENTREPRISE_FABS: {},
}));
import { cmuSalarieDe } from "./paie-bulletin-actions";

describe("cmuSalarieDe — CMU affichée sur la fiche bulletin", () => {
  it("lit la rubrique 470 écrite par le moteur actuel (et non un forfait de 1 000)", () => {
    const lignes = [
      { numero_rubrique: "469", retenue: 8938 },
      { numero_rubrique: "470", retenue: 500 },
    ];
    expect(cmuSalarieDe(lignes)).toBe(500);
  });
  it("lit la rubrique 776 des bulletins antérieurs à la migration 0084", () => {
    expect(cmuSalarieDe([{ numero_rubrique: "776", retenue: 500 }])).toBe(500);
  });
  it("renvoie null sans ligne CMU, au lieu d'inventer un montant", () => {
    expect(cmuSalarieDe([{ numero_rubrique: "150", retenue: 0 }])).toBeNull();
    expect(cmuSalarieDe(undefined)).toBeNull();
  });
  it("garde un zéro enregistré", () => {
    expect(cmuSalarieDe([{ numero_rubrique: "470", retenue: 0 }])).toBe(0);
  });
});
