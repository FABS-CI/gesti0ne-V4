import { describe, it, expect } from "vitest";
import { formatFCFA, formatNumber, formatPercent, formatDate, formatDateLong, formatRelative } from "./format";

describe("formatFCFA", () => {
  it("null → tiret", () => expect(formatFCFA(null)).toBe("—"));
  it("zéro", () => expect(formatFCFA(0)).toBe("0 FCFA"));
  it("grand nombre", () => expect(formatFCFA(1234567)).toBe("1 234 567 FCFA"));
  it("négatif", () => expect(formatFCFA(-1500)).toBe("-1 500 FCFA"));
  it("arrondi", () => expect(formatFCFA(999.6)).toBe("1 000 FCFA"));
});

describe("formatNumber", () => {
  it("null → tiret", () => expect(formatNumber(undefined)).toBe("—"));
  it("décimales à la virgule", () => expect(formatNumber(1234.5, 2)).toBe("1 234,50"));
  it("négatif", () => expect(formatNumber(-1234567)).toBe("-1 234 567"));
});

describe("formatPercent", () => {
  it("12,5 %", () => expect(formatPercent(12.5)).toBe("12,5\u00a0%"));
  it("entier sans décimale", () => expect(formatPercent(10)).toBe("10\u00a0%"));
  it("null → tiret", () => expect(formatPercent(null)).toBe("—"));
});

describe("dates", () => {
  it("formatDate JJ/MM/AAAA", () => expect(formatDate(new Date(2026, 9, 8))).toBe("08/10/2026"));
  it("formatDateLong", () => expect(formatDateLong(new Date(2026, 9, 8))).toBe("8 octobre 2026"));
  it("formatRelative en jours", () =>
    expect(formatRelative(new Date(2026, 9, 5), new Date(2026, 9, 8))).toBe("il y a 3 jours"));
  it("null → tiret", () => expect(formatDate(null)).toBe("—"));
});
