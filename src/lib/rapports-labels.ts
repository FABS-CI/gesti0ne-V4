/**
 * Normalisation d'AFFICHAGE des libellés du rapport d'analyse.
 * Ne modifie jamais les valeurs envoyées aux RPC ni la base.
 */

/** Supprime espaces en trop (début, fin, doubles). */
export function cleanSpaces(v: string): string {
  return v.replace(/\s+/g, " ").trim();
}

/** Clé de regroupement : insensible à la casse, aux accents et aux espaces. */
export function groupKey(v: string | null | undefined): string {
  return cleanSpaces(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

const PETITS_MOTS = new Set(["de", "du", "des", "la", "le", "les", "et", "d", "l", "en", "sur"]);

/** Casse « Titre » pour les villes : « GRAND-BASSAM » → « Grand-Bassam ». */
export function titleCaseVille(v: string | null | undefined): string {
  const s = cleanSpaces(v ?? "").toLowerCase();
  if (!s) return "";
  return s
    .split(" ")
    .map((word, i) =>
      word
        .split(/([-'’()])/)
        .map((part) => {
          if (!part || /^[-'’()]$/.test(part)) return part;
          if (i > 0 && PETITS_MOTS.has(part)) return part;
          return part.charAt(0).toUpperCase() + part.slice(1);
        })
        .join(""),
    )
    .join(" ");
}

/**
 * Regroupe des valeurs brutes par clé normalisée. Chaque groupe garde toutes
 * ses valeurs d'origine (pour filtrer correctement) et un libellé affiché.
 */
export function groupLabels(
  values: (string | null | undefined)[],
  format: (v: string) => string = cleanSpaces,
): { key: string; label: string; values: string[] }[] {
  const map = new Map<string, { key: string; label: string; values: string[] }>();
  for (const raw of values) {
    if (raw == null) continue;
    const k = groupKey(raw);
    if (!k) continue;
    const g = map.get(k);
    if (g) {
      if (!g.values.includes(raw)) g.values.push(raw);
    } else {
      map.set(k, { key: k, label: format(raw), values: [raw] });
    }
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, "fr"));
}
