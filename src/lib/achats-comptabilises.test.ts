import { describe, expect, it } from "vitest";
import { totalAchatsComptabilises } from "./achats-comptabilises";

describe("totalAchatsComptabilises", () => {
  it("ne compte que les achats reçus ou payés", () => {
    const r = totalAchatsComptabilises([
      { montant: 10_000_000, statut: "recu" },
      { montant: 3_770_000, statut: "paye" },
      { montant: 500_000, statut: "brouillon" },
      { montant: 200_000, statut: "commande" },
      { montant: 100_000, statut: "annule" },
    ]);
    expect(r).toEqual({ nb: 2, total: 13_770_000 });
  });
});
