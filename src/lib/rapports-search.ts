import { z } from "zod";
import type { RapportFilters } from "@/lib/rapports-api";

/** État de la page Analyse des ventes conservé dans l'URL. */
const list = z.array(z.string()).optional().catch(undefined);
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined);

export const rapportAnalyseSearchSchema = z.object({
  from: isoDate,
  to: isoDate,
  niveaux: list,
  categories: list,
  types: list,
  villes: list,
  produits: list,
  dim: z.enum(["produits", "niveau", "categorie", "ville", "type"]).optional().catch(undefined),
  tri: z.string().max(30).optional().catch(undefined),
  sens: z.enum(["asc", "desc"]).optional().catch(undefined),
  page: z.number().int().min(1).optional().catch(undefined),
  ps: z.union([z.literal(25), z.literal(50), z.literal(100)]).optional().catch(undefined),
  cmp: z.boolean().optional().catch(undefined),
  gran: z.enum(["jour", "semaine", "mois", "annee"]).optional().catch(undefined),
});

export type AnalyseDim = "produits" | "niveau" | "categorie" | "ville" | "type";

/** Dimension d'agrégat → clé du filtre correspondant. */
export const DIM_FILTER_KEY = {
  niveau: "niveaux",
  categorie: "categories",
  ville: "villes",
  type: "types",
} as const;

export type RapportAnalyseSearch = z.infer<typeof rapportAnalyseSearchSchema>;

const FILTER_KEYS = ["niveaux", "categories", "types", "villes", "produits"] as const;

export function searchToFilters(s: RapportAnalyseSearch): RapportFilters {
  const f: RapportFilters = {};
  if (s.from) f.from = s.from;
  if (s.to) f.to = s.to;
  for (const k of FILTER_KEYS) if (s[k]?.length) f[k] = s[k];
  return f;
}

export function filtersToSearch(f: RapportFilters): Partial<RapportAnalyseSearch> {
  const out: Partial<RapportAnalyseSearch> = {
    from: f.from || undefined,
    to: f.to || undefined,
  };
  for (const k of FILTER_KEYS) out[k] = f[k]?.length ? f[k] : undefined;
  return out;
}
