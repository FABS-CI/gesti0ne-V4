/**
 * Raccourcis de période du rapport d'analyse, calculés sur le calendrier
 * d'Abidjan (Africa/Abidjan) et jamais via toISOString() du poste, qui
 * peut décaler la date d'un jour.
 */
export const RAPPORT_TIMEZONE = "Africa/Abidjan";

export type PeriodePreset =
  | "today"
  | "yesterday"
  | "7d"
  | "week"
  | "month"
  | "quarter"
  | "year"
  | "12m";

export const PERIODE_PRESETS: { key: PeriodePreset; label: string }[] = [
  { key: "today", label: "Aujourd'hui" },
  { key: "yesterday", label: "Hier" },
  { key: "7d", label: "7 derniers jours" },
  { key: "week", label: "Cette semaine" },
  { key: "month", label: "Ce mois" },
  { key: "quarter", label: "Ce trimestre" },
  { key: "year", label: "Cette année" },
  { key: "12m", label: "12 derniers mois" },
];

type Ymd = { y: number; m: number; d: number }; // m : 1–12

/** Date du jour (année, mois, jour) dans le fuseau d'Abidjan. */
export function todayInTimezone(now: Date = new Date(), timeZone = RAPPORT_TIMEZONE): Ymd {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

// Arithmétique calendaire en UTC pur : aucun fuseau du poste n'intervient.
const toUtc = ({ y, m, d }: Ymd) => new Date(Date.UTC(y, m - 1, d));
const fromUtc = (dt: Date): Ymd => ({
  y: dt.getUTCFullYear(),
  m: dt.getUTCMonth() + 1,
  d: dt.getUTCDate(),
});
const addDays = (v: Ymd, n: number) => {
  const dt = toUtc(v);
  dt.setUTCDate(dt.getUTCDate() + n);
  return fromUtc(dt);
};
const pad = (n: number) => String(n).padStart(2, "0");
export const ymdToIso = ({ y, m, d }: Ymd) => `${y}-${pad(m)}-${pad(d)}`;

export function computeRapportPeriode(
  preset: PeriodePreset,
  now: Date = new Date(),
): { from: string; to: string } {
  const t = todayInTimezone(now);
  const iso = ymdToIso;
  switch (preset) {
    case "today":
      return { from: iso(t), to: iso(t) };
    case "yesterday": {
      const y = addDays(t, -1);
      return { from: iso(y), to: iso(y) };
    }
    case "7d":
      return { from: iso(addDays(t, -6)), to: iso(t) };
    case "week": {
      const dow = toUtc(t).getUTCDay(); // 0 = dimanche
      const sinceMonday = (dow + 6) % 7;
      return { from: iso(addDays(t, -sinceMonday)), to: iso(t) };
    }
    case "month":
      return { from: iso({ y: t.y, m: t.m, d: 1 }), to: iso(t) };
    case "quarter": {
      const qm = Math.floor((t.m - 1) / 3) * 3 + 1;
      return { from: iso({ y: t.y, m: qm, d: 1 }), to: iso(t) };
    }
    case "year":
      return { from: iso({ y: t.y, m: 1, d: 1 }), to: iso(t) };
    case "12m": {
      // Du même jour il y a 12 mois (+1 jour) à aujourd'hui inclus.
      const start = fromUtc(new Date(Date.UTC(t.y - 1, t.m - 1, t.d)));
      return { from: iso(addDays(start, 1)), to: iso(t) };
    }
  }
}

const parseIso = (iso: string): Ymd => {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
};
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** Libellé lisible d'une période : « 1 – 13 oct. 2026 ». */
export function formatPeriodeLabel(from?: string, to?: string): string {
  if (!from && !to) return "Toute la période";
  const f = (v: Ymd, withMonth = true, withYear = true) =>
    [String(v.d), withMonth ? MOIS[v.m - 1] : "", withYear ? String(v.y) : ""]
      .filter(Boolean)
      .join(" ");
  if (from && !to) return `Depuis le ${f(parseIso(from))}`;
  if (!from && to) return `Jusqu'au ${f(parseIso(to))}`;
  const a = parseIso(from as string);
  const b = parseIso(to as string);
  if (a.y === b.y && a.m === b.m && a.d === b.d) return f(a);
  if (a.y === b.y && a.m === b.m) return `${a.d} – ${f(b)}`;
  if (a.y === b.y) return `${f(a, true, false)} – ${f(b)}`;
  return `${f(a)} – ${f(b)}`;
}

/** Période précédente de même durée, juste avant la période choisie. */
export function previousPeriode(from: string, to: string): { from: string; to: string } {
  const a = toUtc(parseIso(from));
  const b = toUtc(parseIso(to));
  const days = Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1;
  const prevTo = addDays(parseIso(from), -1);
  return { from: ymdToIso(addDays(prevTo, -(days - 1))), to: ymdToIso(prevTo) };
}

/** Retrouve le raccourci correspondant à une période, s'il y en a un. */
export function matchPreset(from?: string, to?: string, now: Date = new Date()): PeriodePreset | null {
  if (!from || !to) return null;
  for (const p of PERIODE_PRESETS) {
    const r = computeRapportPeriode(p.key, now);
    if (r.from === from && r.to === to) return p.key;
  }
  return null;
}
