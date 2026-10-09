/**
 * Périodes du filtre Paiements. `date_paiement` est une colonne DATE :
 * les bornes "YYYY-MM-DD" sont incluses (gte/lte), donc la journée entière
 * du début et de la fin est comprise.
 */
export type PeriodeKey =
  | "all"
  | "today"
  | "yesterday"
  | "week"
  | "month"
  | "last_month"
  | "30d"
  | "90d"
  | "year"
  | "custom";

export const PERIODES_PAIEMENT: { value: PeriodeKey; label: string }[] = [
  { value: "all", label: "Toutes les dates" },
  { value: "today", label: "Aujourd'hui" },
  { value: "yesterday", label: "Hier" },
  { value: "week", label: "Cette semaine" },
  { value: "month", label: "Ce mois" },
  { value: "last_month", label: "Le mois dernier" },
  { value: "30d", label: "Les 30 derniers jours" },
  { value: "90d", label: "Les 90 derniers jours" },
  { value: "year", label: "Cette année" },
  { value: "custom", label: "Période personnalisée" },
];

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function computePeriode(
  key: PeriodeKey,
  now: Date = new Date(),
): { from?: string; to?: string } {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  switch (key) {
    case "today":
      return { from: iso(now), to: iso(now) };
    case "yesterday": {
      const t = new Date(y, m, d - 1);
      return { from: iso(t), to: iso(t) };
    }
    case "week": {
      const dow = (now.getDay() + 6) % 7; // lundi = 0
      return { from: iso(new Date(y, m, d - dow)), to: iso(now) };
    }
    case "month":
      return { from: iso(new Date(y, m, 1)), to: iso(now) };
    case "last_month":
      return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
    case "30d":
      return { from: iso(new Date(y, m, d - 29)), to: iso(now) };
    case "90d":
      return { from: iso(new Date(y, m, d - 89)), to: iso(now) };
    case "year":
      return { from: iso(new Date(y, 0, 1)), to: iso(now) };
    default:
      return {};
  }
}

export function inPeriode(date: string, from?: string, to?: string) {
  const day = date.slice(0, 10);
  return (!from || day >= from) && (!to || day <= to);
}
