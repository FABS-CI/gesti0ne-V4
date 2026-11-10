import type { EtatCompteLigne } from "./fabsTemplates";

/** Avoir lines come from the existing financially validated, period-filtered source. */
export function hasStatementReturns(lignes: readonly EtatCompteLigne[]): boolean {
  return lignes.some((ligne) =>
    ligne.type === "Avoir" &&
    typeof ligne.credit === "number" &&
    Number.isFinite(ligne.credit) &&
    ligne.credit !== 0,
  );
}