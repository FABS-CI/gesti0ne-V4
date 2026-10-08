import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const EMOJI = /[\u2705\u274C\u26A0\u2714\u2713\u2717\u2718\u2610\u2611\u26A1\u{1F300}-\u{1FAFF}]/u;
const AI_ICONS = /<(Sparkles|Wand2|WandSparkles|Bot|Stars)\b/;
const SKIP = /(pdf|etiquet|label|qr|print|\.test\.)/i;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".tsx") && !SKIP.test(p)) out.push(p);
  }
  return out;
}

const files = [...walk("src/components"), ...walk("src/routes")];

describe("interface sans emoji ni icône IA", () => {
  it("aucun emoji dans les écrans", () => {
    expect(files.filter((f) => EMOJI.test(readFileSync(f, "utf8")))).toEqual([]);
  });
  it("aucune icône Sparkles/Wand/Bot", () => {
    expect(files.filter((f) => AI_ICONS.test(readFileSync(f, "utf8")))).toEqual([]);
  });
});
