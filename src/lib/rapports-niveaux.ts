import { groupKey } from "@/lib/rapports-labels";

/** Regroupement des niveaux scolaires par cycle, par analyse du libellé existant. */
export type Cycle = "Maternelle" | "Primaire" | "Collège" | "Lycée" | "Autres";
export const CYCLES: Cycle[] = ["Maternelle", "Primaire", "Collège", "Lycée", "Autres"];

// Ordre pédagogique : chaque entrée = [cycle, motif sur le libellé normalisé].
const ORDRE: [Cycle, RegExp][] = [
  ["Maternelle", /\b(petite section|ps)\b/],
  ["Maternelle", /\b(moyenne section|ms)\b/],
  ["Maternelle", /\b(grande section|gs)\b/],
  ["Maternelle", /\bmaternelle\b/],
  ["Primaire", /\bcp\s*1\b/],
  ["Primaire", /\bcp\s*2\b/],
  ["Primaire", /\bcp\b/],
  ["Primaire", /\bce\s*1\b/],
  ["Primaire", /\bce\s*2\b/],
  ["Primaire", /\bcm\s*1\b/],
  ["Primaire", /\bcm\s*2\b/],
  ["Primaire", /\bprimaire\b/],
  ["Collège", /\b6\s*(e|eme|ieme)\b/],
  ["Collège", /\b5\s*(e|eme|ieme)\b/],
  ["Collège", /\b4\s*(e|eme|ieme)\b/],
  ["Collège", /\b3\s*(e|eme|ieme)\b/],
  ["Collège", /\b(college|premier cycle)\b/],
  ["Lycée", /\b(2nde|2nd|seconde)\b/],
  ["Lycée", /\b(1ere|premiere)\b/],
  ["Lycée", /\b(terminale|tle)\b/],
  ["Lycée", /\b(lycee|second cycle)\b/],
];

export function classifyNiveau(label: string): { cycle: Cycle; rank: number } {
  const k = groupKey(label);
  for (let i = 0; i < ORDRE.length; i++) {
    if (ORDRE[i][1].test(k)) return { cycle: ORDRE[i][0], rank: i };
  }
  return { cycle: "Autres", rank: ORDRE.length };
}

/** Trie les niveaux dans l'ordre pédagogique et les range par cycle. */
export function groupNiveaux(labels: string[]): { cycle: Cycle; items: string[] }[] {
  const sorted = labels
    .map((l) => ({ l, ...classifyNiveau(l) }))
    .sort((a, b) => a.rank - b.rank || a.l.localeCompare(b.l, "fr"));
  return CYCLES.map((cycle) => ({
    cycle,
    items: sorted.filter((x) => x.cycle === cycle).map((x) => x.l),
  })).filter((g) => g.items.length > 0);
}
