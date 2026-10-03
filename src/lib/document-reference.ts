/**
 * Référence métier affichée des documents de vente : |TYPE|AA|NUMÉRO NET.
 * Affichage uniquement — la référence stockée (ex. FAC-2026-00051) reste la
 * valeur technique (QR, certification, liens, recherche).
 */
const TYPE_MAP: Record<string, string> = {
  FAC: "FC",
  FC: "FC",
  PRO: "PFMA",
  PF: "PFMA",
  PFMA: "PFMA",
  CMD: "BC",
  BC: "BC",
  BL: "BL",
  PAI: "PAI",
  REC: "REC",
};

const RE = /^([A-Z]+)-(\d{2}|\d{4})-0*(\d+)$/i;

export function formatDocumentReference(ref: string | null | undefined): string {
  const raw = (ref ?? "").trim();
  const m = RE.exec(raw);
  if (!m) return raw;
  const type = TYPE_MAP[m[1].toUpperCase()];
  if (!type) return raw;
  const yy = m[2].slice(-2);
  const num = String(parseInt(m[3], 10));
  return `|${type}|${yy}|${num}`;
}

/**
 * Référence raccourcie conservant le préfixe d'origine : FAC-2026-00056 → FAC-2026-56.
 * Affichage uniquement (libellé du relevé) — la référence stockée reste inchangée.
 */
export function shortenReference(ref: string | null | undefined): string {
  const raw = (ref ?? "").trim();
  const m = RE.exec(raw);
  if (!m) return raw;
  return `${m[1].toUpperCase()}-${m[2]}-${String(parseInt(m[3], 10))}`;
}

/** Convertit une saisie |FC|26|51 en motif de recherche sur la référence stockée. */
export function toStoredReferencePattern(input: string): string | null {
  const m = /^\|?([A-Z]+)\|(\d{2})\|(\d+)$/i.exec(input.trim());
  if (!m) return null;
  const back: Record<string, string> = { FC: "FAC", PFMA: "PRO", BC: "CMD", BL: "BL", PAI: "PAI", REC: "REC" };
  const t = back[m[1].toUpperCase()];
  if (!t) return null;
  return `${t}-20${m[2]}-${m[3].padStart(5, "0")}`;
}
