import { describe, it, expect } from "vitest";
import { partsFiscales } from "./parts-fiscales";

describe("partsFiscales", () => {
  it("célibataire sans enfant = 1", () => expect(partsFiscales("celibataire", 0)).toBe(1));
  it("célibataire 1 enfant = 1,5", () => expect(partsFiscales("celibataire", 1)).toBe(1.5));
  it("divorcé 3 enfants = 2,5", () => expect(partsFiscales("divorce", 3)).toBe(2.5));
  it("marié 2 enfants = 3", () => expect(partsFiscales("marie", 2)).toBe(3));
  it("plafond 5", () => expect(partsFiscales("marie", 9)).toBe(5));
});
