import { supabase } from "@/integrations/supabase/client";

export type PaieParametre = {
  parametre_id: string;
  code: string;
  libelle: string;
  valeur: number;
  unite: string;
  categorie: string;
  actif: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type PaieRubrique = {
  rubrique_id: string;
  code: string;
  libelle: string;
  type: "gain" | "retenue" | "patronale";
  mode_calcul: "fixe" | "pourcentage" | "formule";
  base: "salaire_base" | "salaire_brut" | "salaire_imposable";
  taux: number;
  montant_fixe: number;
  soumis_cnps: boolean;
  soumis_its: boolean;
  soumis_igr: boolean;
  ordre: number;
  actif: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export async function listParametres(): Promise<PaieParametre[]> {
  const { data, error } = await supabase
    .from("paie_parametres")
    .select("*")
    .order("categorie", { ascending: true })
    .order("code", { ascending: true });
  if (error) throw error;
  return (data ?? []).flatMap((row) => {
    if (!row.parametre_id || !row.code || !row.libelle || !row.unite || !row.categorie) return [];
    return [{
      ...row,
      parametre_id: row.parametre_id,
      code: row.code,
      libelle: row.libelle,
      valeur: Number(row.valeur ?? 0),
      unite: row.unite,
      categorie: row.categorie,
      actif: row.actif ?? false,
      created_at: row.created_at ?? "",
      updated_at: row.updated_at ?? "",
    }];
  });
}

export async function listRubriques(): Promise<PaieRubrique[]> {
  const { data, error } = await supabase
    .from("paie_rubriques")
    .select("*")
    .order("ordre", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PaieRubrique[];
}

/** Renvoie une map code -> valeur numérique pour un accès O(1) dans le moteur. */
export function paramMap(list: PaieParametre[]): Record<string, number> {
  return Object.fromEntries(list.map((p) => [p.code, Number(p.valeur)]));
}
