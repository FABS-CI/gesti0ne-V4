import { pgSafe } from "@/lib/postgrest-filter";
import { getCurrentUser } from "@/lib/current-user";
import { supabase } from "@/integrations/supabase/client";

export type ColisageResponsable = {
  responsable_id: string;
  employe_id: string;
  matricule: string;
  nom_complet: string;
  poste: string | null;
  telephone: string | null;
  depot_id: string | null;
  depot_nom: string | null;
  actif: boolean;
  date_affectation: string;
};

export async function listResponsables(params?: {
  search?: string;
  actif?: boolean | "all";
}): Promise<ColisageResponsable[]> {
  let query = supabase
    .from("v_colisage_responsables")
    .select(
      "responsable_id, employe_id, matricule, nom_complet, poste, telephone, depot_id, depot_nom, actif, date_affectation",
    )
    .order("nom_complet");
  const actif = params?.actif;
  if (actif === true || actif === false) query = query.eq("actif", actif);
  const s = (params?.search ?? "").trim();
  if (s) query = query.or(`nom_complet.ilike.%${pgSafe(s)}%,matricule.ilike.%${pgSafe(s)}%`);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ColisageResponsable[];
}

export async function listResponsablesActifs(): Promise<ColisageResponsable[]> {
  return listResponsables({ actif: true });
}

export async function createResponsable(input: {
  employe_id: string;
  depot_id?: string | null;
}): Promise<void> {
  const { data: auth } = await getCurrentUser();
  const { error } = await supabase.from("colisage_responsables").insert({
    employe_id: input.employe_id,
    depot_id: input.depot_id ?? null,
    created_by: auth.user?.id ?? null,
    updated_by: auth.user?.id ?? null,
  });
  if (error) throw error;
}

export async function updateResponsable(
  responsable_id: string,
  patch: { depot_id?: string | null },
): Promise<void> {
  const { data: auth } = await getCurrentUser();
  const { error } = await supabase
    .from("colisage_responsables")
    .update({ ...patch, updated_by: auth.user?.id ?? null })
    .eq("responsable_id", responsable_id);
  if (error) throw error;
}

export async function setResponsableActif(responsable_id: string, actif: boolean): Promise<void> {
  const { data: auth } = await getCurrentUser();
  const { error } = await supabase
    .from("colisage_responsables")
    .update({ actif, updated_by: auth.user?.id ?? null })
    .eq("responsable_id", responsable_id);
  if (error) throw error;
}
