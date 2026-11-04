import { describe, it, expect } from "vitest";
import { formatFCFA, formatNumber, formatPercent, formatDate, formatDateLong, formatRelative, formatTelephone } from "./format";

describe("formatFCFA", () => {
  it("null → tiret", () => expect(formatFCFA(null)).toBe("—"));
  it("zéro", () => expect(formatFCFA(0)).toBe("0 FCFA"));
  it("grand nombre", () => expect(formatFCFA(1234567)).toBe("1 234 567 FCFA"));
  it("négatif", () => expect(formatFCFA(-1500)).toBe("-1 500 FCFA"));
  it("arrondi", () => expect(formatFCFA(999.6)).toBe("1 000 FCFA"));
  it("sans suffixe", () => expect(formatFCFA(232012, false)).toBe("232 012"));
  it("NaN et infini → tiret", () => {
    expect(formatFCFA(Number.NaN)).toBe("—");
    expect(formatFCFA(Number.POSITIVE_INFINITY)).toBe("—");
  });
  it("petit négatif arrondi → 0, jamais -0", () => expect(formatFCFA(-0.4)).toBe("0 FCFA"));
  it("devise une seule fois", () => expect(formatFCFA(232012).match(/FCFA/g)).toHaveLength(1));
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

describe("formatTelephone", () => {
  it("10 chiffres", () => expect(formatTelephone("0759699811")).toBe("+225 07 59 69 98 11"));
  it("indicatif déjà saisi", () => expect(formatTelephone("+2250759699811")).toBe("+225 07 59 69 98 11"));
  it("espaces", () => expect(formatTelephone("07 59 69 98 11")).toBe("+225 07 59 69 98 11"));
  it("autre format conservé", () => expect(formatTelephone("+33 6 12 34 56 78")).toBe("+33 6 12 34 56 78"));
  it("vide → tiret", () => expect(formatTelephone(null)).toBe("—"));
});
