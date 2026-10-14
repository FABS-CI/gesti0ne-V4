import { describe, it, expect } from "vitest";
import { DEFAULT_COLS, parseColPrefs, SORT_KEY } from "@/lib/rapports-produits-colonnes";
describe("colonnes produits", () => {
  it("8 colonnes par défaut", () => expect(DEFAULT_COLS).toHaveLength(8));
  it("préférence invalide ignorée", () => {
    expect(parseColPrefs('{"extra":["pu","xx"],"densite":"compact"}')).toEqual({ extra: ["pu"], densite: "compact" });
    expect(parseColPrefs("{bad")).toEqual({ extra: [], densite: "confortable" });
  });
  it("% du CA trié comme le CA", () => expect(SORT_KEY.pct).toBe("ca"));
});
