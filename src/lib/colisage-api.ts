import { supabase } from "@/integrations/supabase/client";
import { callRpc } from "@/lib/rpc";

export type ModeAcheminement = "livraison" | "expedition";

export type BLAColiser = {
  bl_id: string;
  reference: string;
  date_emission: string;
  date_livraison: string | null;
  statut: string;
  client_id: string | null;
  commande_id: string | null;
  client_nom: string | null;
  etablissement: string | null;
  representant_nom: string | null;
  telephone: string | null;
  ville: string | null;
  adresse: string | null;
  commande_reference: string | null;
  nb_articles: number;
  total_quantite: number;
};

export const STATUTS_BL = [
  { value: "a_preparer", label: "À préparer", color: "#F97316" },
  { value: "colisage_en_cours", label: "Colisage en cours", color: "#3B82F6" },
  { value: "colisage_termine", label: "Colisage terminé", color: "#10B981" },
  { value: "livre", label: "Livré", color: "#059669" },
  { value: "expedie", label: "Expédié", color: "#6366F1" },
  { value: "annule", label: "Annulé", color: "#EF4444" },
] as const;

export const STATUT_BL_LABEL: Record<string, { label: string; color: string }> = Object.fromEntries(
  STATUTS_BL.map((s) => [s.value, { label: s.label, color: s.color }]),
);

export async function listBonsLivraisonAColiser(exerciceId?: string | null): Promise<BLAColiser[]> {
  let query = supabase
    .from("bons_livraison")
    .select(
      "bl_id, reference, date_bon, date_emission, date_livraison, created_at, statut, client_id, commande_id, commandes:commande_id(reference, client_nom, etablissement, representant_nom, telephone, ville, adresse, nb_produits, total_quantite)",
    )
    .order("date_emission", { ascending: false });
  if (exerciceId) query = query.eq("exercice_id", exerciceId);
  const { data, error } = await query;
  if (error) throw error;
  type Row = {
    bl_id: string;
    reference: string;
    date_emission: string;
    date_livraison: string | null;
    statut: string;
    client_id: string | null;
    commande_id: string | null;
    commandes: {
      reference: string | null;
      client_nom: string | null;
      etablissement: string | null;
      representant_nom: string | null;
      telephone: string | null;
      ville: string | null;
      adresse: string | null;
      nb_produits: number | null;
      total_quantite: number | null;
    } | null;
  };
  return (data as unknown as Row[]).map((r) => ({
    bl_id: r.bl_id,
    reference: r.reference,
    date_emission: r.date_emission,
    date_livraison: r.date_livraison,
    statut: r.statut,
    client_id: r.client_id,
    commande_id: r.commande_id,
    client_nom: r.commandes?.client_nom ?? null,
    etablissement: r.commandes?.etablissement ?? null,
    representant_nom: r.commandes?.representant_nom ?? null,
    telephone: r.commandes?.telephone ?? null,
    ville: r.commandes?.ville ?? null,
    adresse: r.commandes?.adresse ?? null,
    commande_reference: r.commandes?.reference ?? null,
    nb_articles: r.commandes?.nb_produits ?? 0,
    total_quantite: r.commandes?.total_quantite ?? 0,
  }));
}

export type BLDetail = BLAColiser & {
  facture_reference: string | null;
  lignes: {
    ligne_id: string;
    produit_id: string | null;
    designation: string | null;
    reference_produit: string | null;
    quantite: number;
    cover_path?: string | null;
  }[];
};

export async function getBLDetail(blId: string): Promise<BLDetail | null> {
  const { data, error } = await supabase
    .from("bons_livraison")
    .select(
      "bl_id, reference, date_emission, date_livraison, statut, client_id, commande_id, commandes:commande_id(reference, client_nom, etablissement, representant_nom, telephone, ville, adresse, nb_produits, total_quantite)",
    )
    .eq("bl_id", blId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  let lignes: BLDetail["lignes"] = [];
  let facture_reference: string | null = null;
  if (data.commande_id) {
    const [{ data: ls }, { data: fact }] = await Promise.all([
      supabase
        .from("commande_lignes")
        .select("ligne_id, produit_id, designation, reference_produit, quantite, produits:produit_id(cover_path)")
        .eq("commande_id", data.commande_id),
      supabase
        .from("factures")
        .select("reference")
        .eq("commande_id", data.commande_id)
        .maybeSingle(),
    ]);
    lignes = (ls ?? []).map((l) => ({
      ligne_id: l.ligne_id,
      produit_id: l.produit_id,
      designation: l.designation,
      reference_produit: l.reference_produit,
      quantite: l.quantite,
      cover_path: (l.produits as any)?.cover_path ?? null,
    }));
    facture_reference = fact?.reference ?? null;
  }

  type Cmd = {
    reference: string | null;
    client_nom: string | null;
    etablissement: string | null;
    representant_nom: string | null;
    telephone: string | null;
    ville: string | null;
    adresse: string | null;
    nb_produits: number | null;
    total_quantite: number | null;
  } | null;
  const cmd = data.commandes as unknown as Cmd;

  // Fallback: enrich missing contact/address fields from the client record
  type ClientFallback = {
    telephone: string | null;
    ville: string | null;
    adresse: string | null;
    representant: string | null;
    nom: string | null;
  };
  let clientFallback: ClientFallback | null = null;
  if (data.client_id) {
    const { data: cli } = await supabase
      .from("clients")
      .select("nom, telephone, ville, adresse, representant")
      .eq("client_id", data.client_id)
      .maybeSingle();
    clientFallback = (cli as ClientFallback | null) ?? null;
  }


  const telephone =
    cmd?.telephone ?? clientFallback?.telephone ?? null;

  const clientNom = cmd?.client_nom ?? clientFallback?.nom ?? null;

  return {
    bl_id: data.bl_id,
    reference: data.reference ?? "—",
    date_emission: data.date_emission ?? data.date_bon ?? data.created_at,
    date_livraison: data.date_livraison,
    statut: data.statut,
    client_id: data.client_id,
    commande_id: data.commande_id,
    commande_reference: cmd?.reference ?? null,
    client_nom: clientNom,
    etablissement: cmd?.etablissement ?? null,
    representant_nom: cmd?.representant_nom ?? clientFallback?.representant ?? null,
    telephone,
    ville: cmd?.ville ?? clientFallback?.ville ?? null,
    adresse: cmd?.adresse ?? clientFallback?.adresse ?? null,
    nb_articles: cmd?.nb_produits ?? 0,
    total_quantite: cmd?.total_quantite ?? 0,
    facture_reference,
    lignes,
  };
}


export type ColisagePayload = {
  nb_cartons: number;
  responsable_nom?: string | null;
  observations?: string | null;
  date_colisage?: string | null;
  mode_acheminement: ModeAcheminement;
  // livraison
  quartier?: string | null;
  commune?: string | null;
  ville_livraison?: string | null;
  // expedition
  gare_depart?: string | null;
  ville_destination?: string | null;
  gare_responsable?: string | null;
  gare_telephone?: string | null;
};

export type ColisRow = {
  colis_id: string;
  reference: string;
  numero_carton: number | null;
  nb_cartons: number | null;
  destinataire: string | null;
  responsable_nom: string | null;
  mode_acheminement: string | null;
  quartier: string | null;
  commune: string | null;
  ville_livraison: string | null;
  gare_depart: string | null;
  ville_destination: string | null;
  gare_responsable: string | null;
  gare_telephone: string | null;
  observations: string | null;
  date_colisage: string | null;
  colis_lignes?: {
    produit_id: string | null;
    designation: string | null;
    reference_produit: string | null;
    quantite: number;
    produits?: { cover_path: string | null } | null;
  }[];
};

export type CartonManuel = {
  numero?: number;
  poids?: number | null;
  observations?: string | null;
  lignes: {
    produit_id: string; // clé (produit_id OU ligne_id de la commande)
    designation?: string | null;
    reference_produit?: string | null;
    quantite: number;
  }[];
};

export async function creerColisageManuel(
  blId: string,
  payload: ColisagePayload,
  cartons: CartonManuel[],
): Promise<ColisRow[]> {
  const { data, error } = await supabase.rpc(
    "creer_colisage_manuel" as never,
    {
      _bl_id: blId,
      _payload: JSON.parse(JSON.stringify(payload)),
      _cartons: JSON.parse(JSON.stringify(cartons)),
    } as never,
  );
  if (error) throw error;
  return (data ?? []) as ColisRow[];
}

export async function listColisForBL(blId: string): Promise<ColisRow[]> {
  const { data: colis, error: colisError } = await supabase
    .from("colis")
    .select(`
      colis_id, reference, numero_carton, nb_cartons, destinataire, responsable_nom, mode_acheminement, 
      livreur_nom, livreur_telephone, vehicule, quartier, commune, ville_livraison, gare_depart, 
      ville_destination, gare_responsable, gare_telephone, observations, date_colisage,
      colis_lignes(produit_id, designation, reference_produit, quantite)
    `)
    .eq("bl_id", blId)
    .order("numero_carton");

  if (colisError) throw colisError;
  if (!colis) return [];

  // Manual enrichment for produits because FK is missing in schema cache
  const produitIds = Array.from(
    new Set(
      colis
        .flatMap((c) => c.colis_lignes || [])
        .map((l) => l.produit_id)
        .filter(Boolean) as string[],
    ),
  );

  let produitsMap: Record<string, { cover_path: string | null }> = {};
  if (produitIds.length > 0) {
    const { data: prods } = await supabase
      .from("produits")
      .select("produit_id, cover_path")
      .in("produit_id", produitIds);

    if (prods) {
      produitsMap = Object.fromEntries(
        prods.map((p) => [p.produit_id, { cover_path: p.cover_path ?? null }]),
      );
    }
  }

  return colis.map((c) => ({
    ...c,
    colis_lignes: (c.colis_lignes || []).map((l) => ({
      ...l,
      produits: l.produit_id ? produitsMap[l.produit_id] : null,
    })),
  })) as ColisRow[];
}

export async function annulerColisage(blId: string, motif?: string | null): Promise<void> {
  const { assertPermission } = await import("@/lib/rbac-api");
  await assertPermission("colisage.annuler");
  const { error } = await callRpc("annuler_colisage", { _bl_id: blId, _motif: motif ?? "" });
  if (error) throw error;
}

export type SupprimerColisageSummary = {
  bl_id: string;
  reference: string | null;
  motif: string | null;
  colis_supprimes: number;
  notifications_supprimees: number;
  envois_supprimes: number;
  livsuivi_supprimes: number;
  livraisons_detachees: number;
  livraisons_commande_detachees: number;
  expeditions_detachees: number;
  tournees_recalculees: number;
  role: "super_admin" | "user";
};

export async function supprimerColisage(
  blId: string,
  motif?: string | null,
): Promise<SupprimerColisageSummary | null> {
  const { data, error } = await supabase.rpc("supprimer_colisage", {
    _bl_id: blId,
    _motif: motif ?? "",
  });
  if (error) throw error;
  return (data as SupprimerColisageSummary | null) ?? null;
}

/** Déverrouille un colisage terminé (Gestionnaire de Stock / Responsable Magasinier / Super Admin).
 *  Le motif est obligatoire et sera enregistré dans l'historique. */
export async function deverrouillerColisage(blId: string, motif: string): Promise<void> {
  const m = (motif ?? "").trim();
  if (!m) throw new Error("Le motif de modification est obligatoire");
  const { assertPermission } = await import("@/lib/rbac-api");
  await assertPermission("colisage.deverrouiller");
  const { error } = await supabase.rpc(
    "deverrouiller_colisage" as never,
    { _bl_id: blId, _motif: m } as never,
  );
  if (error) throw error;
}

/** True when the colisage is still fully editable/annulable by a standard user.
 *  Une fois « colisage_termine » (validé), seul un super_admin peut modifier,
 *  annuler ou supprimer le colisage. */
export function isColisageEnAttente(statut: string | null | undefined): boolean {
  // ATTENTION — double référentiel de statuts BL assumé.
  // Deux nomenclatures coexistent dans les données existantes car la migration
  // de statuts n'a jamais été finalisée en base :
  //   - ancienne : "brouillon" (BL créé), "preparee" (BL prêt à coliser)
  //   - actuelle : "a_preparer", "colisage_en_cours"
  // Les BL historiques portent encore les anciens libellés ; on doit donc
  // accepter les quatre valeurs, sinon ces BL deviennent non modifiables.
  // Ne pas "nettoyer" cette liste sans migration de données préalable.
  return (
    statut === "brouillon" ||
    statut === "preparee" ||
    statut === "a_preparer" ||
    statut === "colisage_en_cours"
  );
}
