import { describe, expect, it } from "vitest";
import { avertissementPeriode } from "./periode-avertissement";
describe("avertissement de période", () => {
  it("signale une période après la date de paiement", () => {
    expect(avertissementPeriode("2027-10-20", "2026-10-31", "2026-10-21")).toBe(
      "La période de paie est postérieure à la date de paiement.",
    );
  });
  it("signale une période après la date d'émission", () => {
    expect(avertissementPeriode("2026-11-01", "", "2026-10-21")).toContain("date d'émission");
  });
  it("ne dit rien pour une période normale", () => {
    expect(avertissementPeriode("2026-10-01", "2026-10-31", "2026-10-21")).toBeNull();
  });
});
