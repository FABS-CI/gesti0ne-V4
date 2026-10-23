// Types de la réponse de la RPC paie_calculer_bulletin (seul calcul de paie).
export interface LigneServeur {
  n: string; d: string; nb?: number | null; b?: number | null; t?: number | null;
  g: number; r: number; bl: "imposable" | "retenue" | "non_imposable" | "arrondi" | "patronal";
}
export interface CalculBulletin {
  regime: "REGIME_2024" | "REGIME_2022";
  jours: number; parts: number; salaire_base: number; sursalaire: number; taux_anciennete: number; transport: number;
  lignes: LigneServeur[]; anomalies: string[]; sources: Record<string, string>;
  brut_imposable: number; non_imposable: number; its: number; cn: number; igr: number; cr: number; cmu: number;
  total_retenues_fs: number; autres_retenues: number; net_avant_arrondi: number; arrondi: number; net: number;
  patronal: { total: number }; cout_salarial: number;
}
