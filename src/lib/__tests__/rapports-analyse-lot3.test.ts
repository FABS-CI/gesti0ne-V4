import { describe, it, expect } from "vitest";
import { computeVariation, formatVariation, formatAxisCompact, formatPct } from "../rapports-kpi";

describe("variation vs période précédente", () => {
  it("hausse favorable", () => {
    const v = computeVariation(1124, 1000)!;
    expect(formatVariation(v)).toBe("▲ 12,4 %");
    expect(v.favorable).toBe(true);
  });
  it("baisse défavorable", () => {
    const v = computeVariation(969, 1000)!;
    expect(formatVariation(v)).toBe("▼ 3,1 %");
    expect(v.favorable).toBe(false);
  });
  it("reste à encaisser : une baisse est favorable", () => {
    expect(computeVariation(800, 1000, true)!.favorable).toBe(true);
    expect(computeVariation(1200, 1000, true)!.favorable).toBe(false);
  });
  it("pas de variation sans base", () => expect(computeVariation(500, 0)).toBeNull());
});

describe("abréviations des axes", () => {
  it("millions", () => expect(formatAxisCompact(4_500_000)).toBe("4,5 M"));
  it("milliers", () => expect(formatAxisCompact(850_000)).toBe("850 k"));
  it("millions ronds", () => expect(formatAxisCompact(2_000_000)).toBe("2 M"));
  it("petits nombres", () => expect(formatAxisCompact(420)).toBe("420"));
  it("pourcentage", () => expect(formatPct(12.44)).toBe("12,4 %"));
});
