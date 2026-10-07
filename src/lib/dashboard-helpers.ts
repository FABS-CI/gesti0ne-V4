import { z } from "zod";
import { fallback } from "@tanstack/zod-adapter";

export const periodeSchema = z.object({
  periode: fallback(z.enum(["7", "30", "90"]), "30").default("30"),
});

export type Periode = "7" | "30" | "90";

export const STATUT_COLORS: Record<string, string> = {
  brouillon: "var(--muted-foreground)",
  confirmee: "var(--info)",
  livree: "var(--success)",
  annulee: "var(--destructive)",
};

export const PERIODES = [
  { value: "7" as const, label: "7 jours" },
  { value: "30" as const, label: "30 jours" },
  { value: "90" as const, label: "90 jours" },
];

export const MOIS = [
  "jan.",
  "fév.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];
