import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dir = "src/components/dashboard";
const files = [
  ...readdirSync(dir)
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => join(dir, f)),
  "src/routes/_authenticated/dashboard-global.tsx",
];
const COLOR = /text-(red|green|orange|yellow|amber|emerald)-\d+|text-(destructive|warning|success)/;
const EMOJI = /\p{Extended_Pictographic}/u;

describe("règles icônes du tableau de bord", () => {
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    it(`${f} : pas d'icône colorée`, () => {
      const bad = src.split("\n").filter((l) => /<[A-Z]\w*\s[^>]*className="[^"]*h-\d/.test(l) && COLOR.test(l));
      expect(bad).toEqual([]);
    });
    it(`${f} : pas d'emoji`, () => {
      expect(EMOJI.test(src)).toBe(false);
    });
  }
});
