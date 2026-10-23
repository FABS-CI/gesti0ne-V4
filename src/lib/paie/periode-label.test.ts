import { describe, expect, it } from "vitest";
import { formatPeriodeLabel } from "./periode-label";

describe("formatPeriodeLabel", () => {
  it("convertit une période ISO en libellé français", () => {
    expect(formatPeriodeLabel("2026-10")).toBe("Octobre 2026");
    expect(formatPeriodeLabel("2026-11")).toBe("Novembre 2026");
    expect(formatPeriodeLabel("2026-1")).toBe("Janvier 2026");
    expect(formatPeriodeLabel("2026-12")).toBe("Décembre 2026");
  });

  it("laisse un libellé déjà en français tel quel", () => {
    expect(formatPeriodeLabel("Octobre 2026")).toBe("Octobre 2026");
    expect(formatPeriodeLabel("Août 2022")).toBe("Août 2022");
  });

  it("garde une valeur inconnue et affiche un tiret si vide", () => {
    expect(formatPeriodeLabel("2026-13")).toBe("2026-13");
    expect(formatPeriodeLabel("Juin 26")).toBe("Juin 26");
    expect(formatPeriodeLabel(null)).toBe("—");
    expect(formatPeriodeLabel("")).toBe("—");
  });
});
