/** Variations et abréviations du rapport d'analyse (affichage uniquement). */

export type Variation = { pct: number; up: boolean; favorable: boolean };

/**
 * Variation en % par rapport à la période précédente.
 * `inverse` : une baisse est favorable (ex. reste à encaisser).
 * Retourne null si la comparaison n'a pas de sens (pas de base).
 */
export function computeVariation(
  current: number | null | undefined,
  previous: number | null | undefined,
  inverse = false,
): Variation | null {
  const c = Number(current ?? 0);
  const p = Number(previous ?? 0);
  if (!Number.isFinite(c) || !Number.isFinite(p) || p === 0) return null;
  const pct = ((c - p) / Math.abs(p)) * 100;
  const up = pct >= 0;
  return { pct, up, favorable: inverse ? !up : up };
}

/** « ▲ 12,4 % » / « ▼ 3,1 % ». */
export function formatVariation(v: Variation): string {
  const val = Math.abs(v.pct).toFixed(1).replace(".", ",");
  return `${v.up ? "▲" : "▼"} ${val} %`;
}

/** Pourcentage français « 12,4 % ». */
export function formatPct(n: number | null | undefined): string {
  return `${Number(n ?? 0).toFixed(1).replace(".", ",")} %`;
}

/** Abréviation pour les axes de graphiques : « 4,5 M », « 850 k ». */
export function formatAxisCompact(n: number): string {
  const a = Math.abs(n);
  const trim = (x: number) => x.toFixed(1).replace(/\.0$/, "").replace(".", ",");
  if (a >= 1_000_000_000) return `${trim(n / 1_000_000_000)} Md`;
  if (a >= 1_000_000) return `${trim(n / 1_000_000)} M`;
  if (a >= 1_000) return `${trim(n / 1_000)} k`;
  return String(Math.round(n));
}
