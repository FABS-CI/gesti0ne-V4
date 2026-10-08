import { format as dateFnsFormat } from "date-fns";

export function formatFCFA(amount: number | null | undefined, withSuffix = true): string {
  if (amount == null || isNaN(Number(amount))) return "—";
  const n = Math.round(Number(amount));
  // Formatage manuel pour garantir l'espace comme séparateur des milliers
  // et éviter les comportements imprévisibles de toLocaleString selon l'env.
  const formatted = n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return withSuffix ? `${formatted} FCFA` : formatted;
}

export function formatFCFACompact(amount: number | null | undefined): string {
  if (amount == null || isNaN(Number(amount))) return "—";
  const n = Number(amount);
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")} M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)} K`;
  return String(n);
}

/**
 * Formate une date au format standard ERP : JJ/MM/AAAA
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return String(date);
  return dateFnsFormat(d, "dd/MM/yyyy");
}

/**
 * Formate une date et heure au format standard ERP : JJ/MM/AAAA HH:mm
 */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return String(date);
  return dateFnsFormat(d, "dd/MM/yyyy HH'h'mm");
}


const NNBSP = "\u00a0";

/** Nombre au format français, séparateur des milliers = espace. */
export function formatNumber(n: number | null | undefined, digits = 0): string {
  if (n == null || isNaN(Number(n))) return "—";
  const fixed = Number(n).toFixed(digits);
  const [int, dec] = fixed.split(".");
  const neg = int.startsWith("-");
  const body = (neg ? int.slice(1) : int).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${neg ? "-" : ""}${body}${dec ? "," + dec : ""}`;
}

/** Pourcentage « 12,5 % » (n déjà exprimé en %). */
export function formatPercent(n: number | null | undefined, digits = 1): string {
  if (n == null || isNaN(Number(n))) return "—";
  const s = formatNumber(n, digits).replace(/,0+$/, "");
  return `${s}${NNBSP}%`;
}

const MOIS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];

/** « 8 octobre 2026 ». */
export function formatDateLong(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return String(date);
  return `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
}

/** « il y a 3 jours » — réservé aux notifications. */
export function formatRelative(date: string | Date | null | undefined, now: Date = new Date()): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return String(date);
  const s = Math.round((now.getTime() - d.getTime()) / 1000);
  if (s < 60) return "à l'instant";
  const m = Math.round(s / 60); if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60); if (h < 24) return `il y a ${h} h`;
  const j = Math.round(h / 24); if (j < 30) return `il y a ${j} jour${j > 1 ? "s" : ""}`;
  return formatDate(d);
}
