import { supabase } from "@/integrations/supabase/client";
import { callRpc } from "@/lib/rpc";

export const TYPES_DEPOT = [
  { value: "principal", label: "Principal" },
  { value: "secondaire", label: "Secondaire" },
  { value: "temporaire", label: "Temporaire" },
  { value: "boutique", label: "Boutique" },
  { value: "autre", label: "Autre" },
] as const;

export type Depot = {
  depot_id: string;
  code: string;
  nom: string;
  type_depot: string;
  description: string | null;
  pays: string | null;
  ville: string | null;
  commune: string | null;
  quartier: string | null;
  adresse: string | null;
  code_postal: string | null;
  latitude: number | null;
  longitude: number | null;
  responsable: string | null;
  responsable_email: string | null;
  telephone: string | null;
  capacite: number | null;
  actif: boolean;
  is_principal: boolean;
  created_at: string;
  updated_at: string;
};

export type DepotInput = Omit<Depot, "depot_id" | "created_at" | "updated_at">;

export async function getDepotProduitCount(depot_id: string): Promise<number> {
  const { count, error } = await supabase
    .from("stocks_depots")
    .select("*", { count: "exact", head: true })
    .eq("depot_id", depot_id)
    .gt("quantite", 0);
  if (error) return 0;
  return count ?? 0;
}

export async function listDepots(): Promise<Depot[]> {
  const { data, error } = await supabase
    .from("depots")
    .select("*")
    .order("is_principal", { ascending: false })
    .order("nom");
  if (error) throw error;
  return (data ?? []) as Depot[];
}

export async function createDepot(input: Partial<DepotInput> & { code: string; nom: string }) {
  const { data, error } = await supabase.from("depots").insert(input).select().single();
  if (error) throw error;
  return data as Depot;
}

export async function updateDepot(depot_id: string, input: Partial<DepotInput>) {
  const { data, error } = await supabase
    .from("depots")
    .update(input)
    .eq("depot_id", depot_id)
    .select()
    .single();
  if (error) throw error;
  return data as Depot;
}

export async function deleteDepot(depot_id: string) {
  const { error } = await supabase.from("depots").delete().eq("depot_id", depot_id);
  if (error) throw error;
}

/** Promeut un dépôt en dépôt principal (les autres deviennent secondaires). */
export async function definirDepotPrincipal(depot_id: string) {
  const { error } = await supabase.rpc("definir_depot_principal", { _depot_id: depot_id });
  if (error) throw error;
}

/** Renvoie l'UUID du dépôt principal actif, ou null si aucun défini. */
export async function getDepotPrincipal(): Promise<string | null> {
  const { data } = await supabase
    .from("depots")
    .select("depot_id")
    .eq("is_principal", true)
    .eq("actif", true)
    .maybeSingle();
  return data?.depot_id ?? null;
}

export type StockDepot = {
  id: string;
  produit_id: string;
  depot_id: string;
  quantite: number;
  seuil_alerte: number;
  updated_at: string;
  depots?: { nom: string; code: string } | null;
};

export async function setSeuilAlerteDepot(produit_id: string, depot_id: string, seuil: number) {
  const { error } = await supabase
    .from("stocks_depots")
    .update({ seuil_alerte: seuil })
    .eq("produit_id", produit_id)
    .eq("depot_id", depot_id);
  if (error) throw error;
}

export type AlerteStock = {
  produit_id: string;
  reference: string | null;
  titre: string;
  depot_id: string;
  depot_nom: string;
  quantite: number;
  seuil: number;
  seuil_produit: number;
  severite: "rupture" | "critique" | "bas";
};

export async function listAlertesStock(): Promise<AlerteStock[]> {
  const [{ data: stocks, error: e1 }, { data: produits, error: e2 }] = await Promise.all([
    supabase.from("stocks_depots").select("*, depots(nom, code)"),
    supabase.from("produits").select("produit_id, reference, titre, seuil_alerte"),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  const pMap = new Map((produits ?? []).map((p) => [p.produit_id, p]));
  const out: AlerteStock[] = [];
  for (const s of stocks ?? []) {
    const p = pMap.get(s.produit_id);
    if (!p) continue;
    const seuilProduit = Number(p.seuil_alerte ?? 0);
    const seuilDepot = Number(s.seuil_alerte ?? 0);
    const seuil = seuilDepot > 0 ? seuilDepot : seuilProduit;
    if (seuil <= 0) continue;
    const qty = Number(s.quantite ?? 0);
    if (qty > seuil) continue;
    const depot = (s as unknown as { depots: { nom: string; code: string } | null }).depots;
    out.push({
      produit_id: p.produit_id,
      reference: p.reference,
      titre: p.titre,
      depot_id: s.depot_id,
      depot_nom: depot?.nom ?? "—",
      quantite: qty,
      seuil,
      seuil_produit: seuilProduit,
      severite: qty === 0 ? "rupture" : qty <= seuil / 2 ? "critique" : "bas",
    });
  }
  return out.sort(
    (a, b) =>
      (a.severite === b.severite
        ? 0
        : a.severite === "rupture"
          ? -1
          : b.severite === "rupture"
            ? 1
            : a.severite === "critique"
              ? -1
              : 1) ||
      a.depot_nom.localeCompare(b.depot_nom) ||
      a.titre.localeCompare(b.titre),
  );
}
export async function ajusterStockDepot(input: {
  produit_id: string;
  depot_id: string;
  nouvelle_quantite: number;
  motif?: string | null;
}) {
  const { error } = await callRpc("ajuster_stock_depot", {
    _produit_id: input.produit_id,
    _depot_id: input.depot_id,
    _nouvelle_quantite: input.nouvelle_quantite,
    _motif: input.motif ?? undefined,
  });
  if (error) throw error;
}

export async function getStocksParDepot(produit_id: string) {
  const { data, error } = await supabase
    .from("stocks_depots")
    .select("*, depots(nom, code)")
    .eq("produit_id", produit_id);
  if (error) throw error;
  return (data ?? []) as StockDepot[];
}

export async function getStockProduitDepot(produit_id: string, depot_id: string): Promise<number> {
  const { data } = await supabase
    .from("stocks_depots")
    .select("quantite")
    .eq("produit_id", produit_id)
    .eq("depot_id", depot_id)
    .maybeSingle();
  const depotQte = data && typeof data.quantite === "number" ? data.quantite : null;
  if (depotQte !== null && depotQte > 0) return depotQte;
  // Soit aucun enregistrement dans stocks_depots pour ce couple, soit dépôt
  // à 0 alors que le produit est en stock ailleurs : retomber sur le stock
  // global du produit pour ne pas bloquer à tort la saisie.
  const { data: prod } = await supabase
    .from("v_produits")
    .select("stock")
    .eq("produit_id", produit_id)
    .maybeSingle();
  const global = prod?.stock ?? 0;
  return global > 0 ? global : (depotQte ?? 0);
}

export type Transfert = {
  transfert_id: string;
  numero: string;
  depot_source_id: string;
  depot_destination_id: string;
  statut: "brouillon" | "expedie" | "recu" | "annule";
  date_creation: string;
  date_expedition: string | null;
  date_reception: string | null;
  transporteur: string | null;
  motif: string | null;
  notes: string | null;
  created_by: string | null;
  source?: { nom: string } | null;
  destination?: { nom: string } | null;
};

export type TransfertLigne = {
  ligne_id: string;
  transfert_id: string;
  produit_id: string;
  quantite: number;
  quantite_recue: number;
  produits?: { titre: string; reference: string } | null;
};

export async function listTransferts(filters?: { statut?: string }): Promise<Transfert[]> {
  let q = supabase
    .from("transferts")
    .select(
      "*, source:depots!transferts_depot_source_id_fkey(nom), destination:depots!transferts_depot_destination_id_fkey(nom)",
    )
    .order("date_creation", { ascending: false });
  if (filters?.statut) q = q.eq("statut", filters.statut);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as Transfert[];
}

export async function getTransfert(transfert_id: string) {
  const { data, error } = await supabase
    .from("transferts")
    .select(
      "*, source:depots!transferts_depot_source_id_fkey(nom), destination:depots!transferts_depot_destination_id_fkey(nom)",
    )
    .eq("transfert_id", transfert_id)
    .single();
  if (error) throw error;
  return data as unknown as Transfert;
}

export async function getTransfertLignes(transfert_id: string) {
  const { data, error } = await supabase
    .from("transfert_lignes")
    .select("*, produits(titre, reference)")
    .eq("transfert_id", transfert_id);
  if (error) throw error;
  return (data ?? []) as unknown as TransfertLigne[];
}

function genNumero() {
  const y = new Date().getFullYear();
  const rnd = Math.floor(Math.random() * 9000) + 1000;
  return `TR-${y}-${rnd}`;
}

export async function createTransfert(input: {
  depot_source_id: string;
  depot_destination_id: string;
  transporteur?: string | null;
  motif?: string | null;
  notes?: string | null;
  lignes: { produit_id: string; quantite: number }[];
}) {
  if (input.depot_source_id === input.depot_destination_id) {
    throw new Error("Dépôts source et destination identiques");
  }
  if (!input.lignes.length) throw new Error("Aucune ligne");

  const { data: t, error } = await supabase
    .from("transferts")
    .insert({
      numero: genNumero(),
      depot_source_id: input.depot_source_id,
      depot_destination_id: input.depot_destination_id,
      transporteur: input.transporteur ?? null,
      motif: input.motif ?? null,
      notes: input.notes ?? null,
      statut: "brouillon",
    })
    .select()
    .single();
  if (error) throw error;

  const lignes = input.lignes.map((l) => ({ ...l, transfert_id: t.transfert_id }));
  const { error: e2 } = await supabase.from("transfert_lignes").insert(lignes);
  if (e2) throw e2;
  return t as unknown as Transfert;
}

export async function executerTransfert(transfert_id: string) {
  const { assertPermission } = await import("@/lib/rbac-api");
  await assertPermission("transferts.executer");
  const { error } = await supabase.rpc("executer_transfert", { _transfert_id: transfert_id });
  if (error) throw error;
}

export async function receptionnerTransfert(transfert_id: string) {
  const { assertPermission } = await import("@/lib/rbac-api");
  await assertPermission("transferts.receptionner");
  const { error } = await supabase.rpc("receptionner_transfert", { _transfert_id: transfert_id });
  if (error) throw error;
}

export async function annulerTransfert(transfert_id: string) {
  const { assertPermission } = await import("@/lib/rbac-api");
  await assertPermission("transferts.annuler");
  const { error } = await callRpc("annuler_transfert", { _transfert_id: transfert_id });
  if (error) throw error;
}