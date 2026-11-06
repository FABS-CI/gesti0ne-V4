import { describe, expect, it } from "vitest";
import {
  anneePrecedente,
  moisDeLaPeriode,
  natureCompte,
  syntheseBalance,
  variation,
} from "@/lib/rapports-comptables";

describe("rapports comptables", () => {
  it("classe les comptes SYSCOHADA", () => {
    expect(natureCompte("701100")).toBe("produit");
    expect(natureCompte("601000")).toBe("charge");
    expect(natureCompte("891000")).toBe("charge");
    expect(natureCompte("821000")).toBe("produit");
    expect(natureCompte("411000")).toBeNull();
  });

  it("calcule résultat, marge et ratios depuis la balance", () => {
    const s = syntheseBalance([
      { compte: "701100", debit: 50_000, credit: 1_050_000 },
      { compte: "601000", debit: 400_000, credit: 0 },
      { compte: "661000", debit: 200_000, credit: 0 },
      { compte: "411000", debit: 999_999, credit: 0 },
    ]);
    expect(s.chiffreAffaires).toBe(1_000_000);
    expect(s.charges).toBe(600_000);
    expect(s.resultat).toBe(400_000);
    expect(s.margeBrute).toBe(600_000);
    expect(s.tauxMargeBrute).toBe(60);
    expect(s.tauxMargeNette).toBe(40);
    expect(s.poidsPersonnel).toBe(20);
  });

  it("ratios nuls si aucun chiffre d'affaires", () => {
    expect(syntheseBalance([]).tauxMargeNette).toBeNull();
    expect(variation(10, 0)).toBeNull();
    expect(variation(150, 100)).toBe(50);
  });

  it("découpe la période en mois bornés", () => {
    const m = moisDeLaPeriode("2026-01-15", "2026-03-10");
    expect(m.map((x) => x.cle)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(m[0].from).toBe("2026-01-15");
    expect(m[1].to).toBe("2026-02-28");
    expect(m[2].to).toBe("2026-03-10");
    expect(anneePrecedente("2024-02-29")).toBe("2023-02-28");
  });
});
