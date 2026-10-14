/** Colonnes du tableau produits de l'analyse des ventes. */
export type ColId =
  | "produit" | "niveau" | "qte" | "ca" | "encaisse" | "reste" | "pct" | "stock"
  | "pu" | "qte_fact" | "nb_fact" | "nb_clients" | "remises" | "retours"
  | "stock_init" | "stock_rest" | "rang";

export const DEFAULT_COLS: ColId[] = ["produit", "niveau", "qte", "ca", "encaisse", "reste", "pct", "stock"];
export const OPTIONAL_COLS: [ColId, string][] = [
  ["pu", "PU"],
  ["qte_fact", "Qté facturée"],
  ["nb_fact", "Nb factures"],
  ["nb_clients", "Nb clients"],
  ["remises", "Remises"],
  ["retours", "Retours"],
  ["stock_init", "Stock initial"],
  ["stock_rest", "Stock restant"],
  ["rang", "Rang"],
];

/**
 * Clé de tri serveur (RPC rapport_produits) par colonne. Le % du CA suit le CA.
 * Colonnes absentes : non triables côté serveur.
 */
export const SORT_KEY: Partial<Record<ColId, string>> = {
  qte: "qte",
  ca: "ca",
  pct: "ca",
  encaisse: "encaisse",
  stock: "stock",
};

export type Densite = "confortable" | "compact";
export type ColPrefs = { extra: ColId[]; densite: Densite };

const KEY = "rapport-produits-colonnes";
const valid = new Set(OPTIONAL_COLS.map(([c]) => c));

export function parseColPrefs(raw: string | null): ColPrefs {
  try {
    const v = raw ? JSON.parse(raw) : null;
    const extra = Array.isArray(v?.extra) ? v.extra.filter((c: ColId) => valid.has(c)) : [];
    return { extra, densite: v?.densite === "compact" ? "compact" : "confortable" };
  } catch {
    return { extra: [], densite: "confortable" };
  }
}

export const loadColPrefs = () => parseColPrefs(window.localStorage.getItem(KEY));
export const saveColPrefs = (p: ColPrefs) => window.localStorage.setItem(KEY, JSON.stringify(p));

export const PAGE_SIZES = [25, 50, 100] as const;
