import { describe, it, expect } from "vitest";
import { numberToLetters } from "@/lib/pdf/number-to-letters";

const CASES: Array<[number, string]> = [
  [0, "Zéro franc CFA"],
  [1, "Un franc CFA"],
  [2, "Deux francs CFA"],
  [21, "Vingt-et-un francs CFA"],
  [71, "Soixante-et-onze francs CFA"],
  [80, "Quatre-vingts francs CFA"],
  [81, "Quatre-vingt-un francs CFA"],
  [91, "Quatre-vingt-onze francs CFA"],
  [100, "Cent francs CFA"],
  [200, "Deux cents francs CFA"],
  [201, "Deux cent un francs CFA"],
  [1000, "Mille francs CFA"],
  [1001, "Mille un francs CFA"],
  [80000, "Quatre-vingt mille francs CFA"],
  [200000, "Deux cent mille francs CFA"],
  [1000000, "Un million de francs CFA"],
  [1500000, "Un million cinq cent mille francs CFA"],
  [2000000, "Deux millions de francs CFA"],
  [80000000, "Quatre-vingts millions de francs CFA"],
  [200000000, "Deux cents millions de francs CFA"],
  [1234567, "Un million deux cent trente-quatre mille cinq cent soixante-sept francs CFA"],
  [1000000000, "Un milliard de francs CFA"],
];

describe("montant en lettres", () => {
  it.each(CASES)("%d", (n, expected) => expect(numberToLetters(n)).toBe(expected));
  it("garde « moins » pour un avoir et arrondit", () => {
    expect(numberToLetters(-2000.4)).toBe("Moins deux mille francs CFA");
  });
});
