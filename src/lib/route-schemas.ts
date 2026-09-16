/**
 * Schémas `search` centralisés + valeurs par défaut associées.
 *
 * Un seul endroit source de vérité pour :
 *  - la validation `validateSearch` (via `zodValidator`) sur la route ;
 *  - la valeur passée à `<Link search={...}>` ou `navigate({ search })`,
 *    ce qui garantit que la forme envoyée correspond exactement à ce que
 *    la route attend (évite les TS2741 et les URL invalides en runtime).
 */
import { z } from "zod";
import { fallback } from "@tanstack/zod-adapter";

/* ---------- /_authenticated/livraison-suivi/$commandeRef[ /remise ] ---------- */

export const commandeRefSearchSchema = z.object({
  debug: fallback(z.boolean(), false).default(false),
});
export type CommandeRefSearch = z.infer<typeof commandeRefSearchSchema>;
export const COMMANDE_REF_SEARCH_DEFAULTS = {
  debug: false,
} as const satisfies CommandeRefSearch;

/* ---------- /_authenticated/exercices/comparatif ---------- */

import { SORT_KEYS } from "@/components/exercices/comparatif/ComparatifFilters";

export const comparatifSearchSchema = z.object({
  exos: z.string().optional().catch(undefined),
  sort: fallback(z.enum(SORT_KEYS), "code").default("code"),
  dir: fallback(z.enum(["asc", "desc"]), "asc").default("asc"),
  pct: fallback(z.boolean(), true).default(true),
});
export type ComparatifSearch = z.infer<typeof comparatifSearchSchema>;
export const COMPARATIF_SEARCH_DEFAULTS = {
  exos: undefined,
  sort: "code",
  dir: "asc",
  pct: true,
} as const satisfies ComparatifSearch;