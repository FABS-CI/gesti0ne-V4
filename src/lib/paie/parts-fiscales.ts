// Grille unique des parts fiscales (ITS Côte d'Ivoire), plafond 5.
export type SituationMatrimoniale = "celibataire" | "marie" | "divorce" | "veuf" | "union_libre" | null | undefined;

export function partsFiscales(situation: SituationMatrimoniale, enfants: number): number {
  const n = Math.max(0, Math.floor(enfants || 0));
  let parts: number;
  if (situation === "marie") parts = 2 + 0.5 * n;
  else parts = n === 0 ? 1 : 1.5 + 0.5 * (n - 1);
  return Math.min(5, parts);
}
