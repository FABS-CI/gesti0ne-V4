/**
 * Chargement serveur du Bon de Livraison rattaché à un carton scanné.
 *
 * Chaîne stricte : QR (colis_id) -> colis -> bons_livraison -> commande.
 * Le PDF téléchargé correspond donc toujours exactement au carton consulté.
 * Aucune donnée financière (prix, remises, totaux) n'est renvoyée.
 */

export type PublicBlPayload = {
  reference: string;
  date: string | null;
  clientNom: string;
  villeClient: string;
  adresseClient: string;
  representant: string;
  clientTel: string;
  lignes: {
    codeArticle?: string;
    reference?: string;
    cycle?: string;
    niveau?: string;
    matiere?: string;
    qte: number;
  }[];
};

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export async function loadCartonBlPayload(colisId: string): Promise<PublicBlPayload | null> {
  if (!isUuid(colisId)) return null;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: colis } = await supabaseAdmin
    .from("colis")
    .select("colis_id, bl_id, commande_id")
    .eq("colis_id", colisId)
    .maybeSingle();
  if (!colis?.bl_id) return null;

  const { data: bl } = await supabaseAdmin
    .from("bons_livraison")
    .select("bl_id, reference, date_emission, statut, commande_id")
    .eq("bl_id", colis.bl_id)
    .maybeSingle();
  if (!bl?.reference) return null;

  const commandeId = (bl as any).commande_id ?? (colis as any).commande_id ?? null;

  let commande: any = null;
  if (commandeId) {
    const { data } = await supabaseAdmin
      .from("commandes")
      .select("commande_id, client_nom, etablissement, representant_nom, telephone, ville, adresse")
      .eq("commande_id", commandeId)
      .maybeSingle();
    commande = data;
  }

  let lignes: PublicBlPayload["lignes"] = [];
  if (commandeId) {
    const { data } = await supabaseAdmin
      .from("commande_lignes")
      .select("produit_id, designation, quantite, reference_produit")
      .eq("commande_id", commandeId);

    const rows = (data ?? []) as any[];
    const ids = Array.from(new Set(rows.map((r) => r.produit_id).filter(Boolean)));
    const produits = new Map<string, any>();
    if (ids.length) {
      const { data: prods } = await supabaseAdmin
        .from("produits")
        .select("produit_id, reference, categorie, niveau, matiere")
        .in("produit_id", ids);
      for (const p of (prods ?? []) as any[]) produits.set(p.produit_id, p);
    }

    lignes = rows.map((r) => {
      const p = r.produit_id ? produits.get(r.produit_id) : null;
      return {
        codeArticle: r.reference_produit ?? p?.reference ?? undefined,
        reference: r.designation ?? undefined,
        cycle: (p?.categorie ?? "").toUpperCase() || undefined,
        niveau: p?.niveau ?? undefined,
        matiere: p?.matiere ?? undefined,
        qte: Number(r.quantite ?? 0),
      };
    });
  }

  return {
    reference: bl.reference,
    date: (bl as any).date_emission ?? null,
    clientNom: commande?.etablissement || commande?.client_nom || "",
    villeClient: commande?.ville || "",
    adresseClient: commande?.adresse || "",
    representant: commande?.representant_nom || "",
    clientTel: commande?.telephone || "",
    lignes,
  };
}
