// Enrichit les lignes de documents (factures, proformas, commandes, BL)
// avec cycle / niveau / matière en joignant produits.categorie pour
// activer le regroupement V10 par cycle scolaire dans les PDF.
import { supabase } from "@/integrations/supabase/client";
import type { DocBase, DocLigne } from "./fabsTemplates";

type RawLigne = {
  produit_id: string | null;
  designation: string | null;
  quantite: number | null;
  prix_unitaire: number | null;
  total_ligne: number | null;
  remise_pct?: number | null;
  montant_remise?: number | null;
  total_ht_ligne?: number | null;
  reference_produit?: string | null;
  produits?: {
    categorie: string | null;
    niveau: string | null;
    matiere: string | null;
    reference: string | null;
  } | null;
};

function toDocLignes(rows: RawLigne[]): DocLigne[] {
  return rows.map((r) => {
    const qte = Number(r.quantite ?? 0);
    const pu = Number(r.prix_unitaire ?? 0);
    const remisePct = r.remise_pct != null ? Number(r.remise_pct) : 0;
    
    // Audit point 8 & 10: Strict math consistency
    const montantBrutLigne = qte * pu;
    const montantRemise = r.montant_remise != null 
      ? Number(r.montant_remise) 
      : Math.round((montantBrutLigne * remisePct) / 100);
      
    const net = r.total_ligne != null
      ? Number(r.total_ligne)
      : montantBrutLigne - montantRemise;

    return {
      codeArticle: r.reference_produit ?? r.produits?.reference ?? undefined,
      reference: r.designation ?? undefined,
      cycle: (r.produits?.categorie ?? "").toUpperCase() || undefined,
      niveau: r.produits?.niveau ?? undefined,
      matiere: r.produits?.matiere ?? undefined,
      qte: qte,
      prixUnitaire: pu,
      montant: net,
      remisePct: remisePct,
      remiseMontant: montantRemise,
    };
  });
}

/**
 * Hydrate les lignes avec les infos produits (categorie, niveau, matiere,
 * reference) via une requête séparée.
 */
async function hydrateProduits(rows: RawLigne[]): Promise<RawLigne[]> {
  const ids = Array.from(
    new Set(rows.map((r) => r.produit_id).filter((v): v is string => !!v)),
  );
  if (ids.length === 0) return rows;
  const { data } = await supabase
    .from("produits")
    .select("produit_id, reference, categorie, niveau, matiere")
    .in("produit_id", ids);
  const map = new Map<string, RawLigne["produits"]>();
  for (const p of (data ?? []) as Array<{
    produit_id: string;
    reference: string | null;
    categorie: string | null;
    niveau: string | null;
    matiere: string | null;
  }>) {
    map.set(p.produit_id, {
      categorie: p.categorie,
      niveau: p.niveau,
      matiere: p.matiere,
      reference: p.reference,
    });
  }
  return rows.map((r) => ({
    ...r,
    produits: r.produit_id ? map.get(r.produit_id) ?? null : null,
  }));
}

/** Lignes enrichies d'une proforma. */
export async function loadProformaDocLignes(proformaId: string): Promise<DocLigne[]> {
  const { data: pf } = await supabase
    .from("proformas")
    .select("commande_id")
    .eq("proforma_id", proformaId)
    .maybeSingle();
  if (pf?.commande_id) {
    return loadCommandeDocLignes(pf.commande_id);
  }
  const { data, error } = await supabase
    .from("proforma_lignes")
    .select("produit_id, designation, quantite, prix_unitaire, total_ligne")
    .eq("proforma_id", proformaId);
  if (error) return [];
  const hydrated = await hydrateProduits((data ?? []) as unknown as RawLigne[]);
  return toDocLignes(hydrated);
}

/** Lignes enrichies d'une commande. */
export async function loadCommandeDocLignes(commandeId: string): Promise<DocLigne[]> {
  const { data, error } = await supabase
    .from("commande_lignes")
    .select(
      "produit_id, designation, quantite, prix_unitaire, total_ligne, remise_pct, montant_remise, total_ht_ligne, reference_produit",
    )
    .eq("commande_id", commandeId);
  if (error) return [];
  const hydrated = await hydrateProduits((data ?? []) as unknown as RawLigne[]);
  return toDocLignes(hydrated);
}

/** Lignes enrichies d'une facture. */
export async function loadFactureDocLignes(factureId: string): Promise<DocLigne[]> {
  const { data: f } = await supabase
    .from("factures")
    .select("commande_id")
    .eq("facture_id", factureId)
    .maybeSingle();
  if (!f?.commande_id) return [];
  return loadCommandeDocLignes(f.commande_id);
}

/** Lignes enrichies d'un bon de livraison. */
export async function loadBLDocLignes(blId: string): Promise<DocLigne[]> {
  const { data: bl } = await supabase
    .from("bons_livraison")
    .select("commande_id")
    .eq("bl_id", blId)
    .maybeSingle();
    
  if (!bl?.commande_id) {
    // Si pas de commande direct, peut-être des colis ?
    // Mais selon le schéma actuel, on se base sur commande_id.
    return [];
  }

  return loadCommandeDocLignes(bl.commande_id);
}

export type DocClientInfo = Pick<
  DocBase,
  | "clientNom"
  | "clientTel"
  | "codeClient"
  | "representant"
  | "representantTel"
  | "emailClient"
  | "adresseClient"
  | "villeClient"
  | "communeClient"
  | "paysClient"
  | "ncc"
  | "modePaiement"
>;

export async function loadClientDocInfo(
  clientId: string | null | undefined,
): Promise<DocClientInfo> {
  if (!clientId) return {} as DocClientInfo;
  const { data } = await supabase
    .from("clients")
    .select(
      "reference, nom, representant, telephone, email, adresse, ville, quartier, pays, nif",
    )
    .eq("client_id", clientId)
    .maybeSingle();
  if (!data) return {};
  return {
    clientNom: data.nom,
    codeClient: data.reference,
    representant: data.representant,
    representantTel: data.telephone,
    clientTel: data.telephone,
    emailClient: data.email,
    adresseClient: data.adresse,
    villeClient: data.ville,
    communeClient: data.quartier,
    paysClient: data.pays,
    ncc: data.nif,
  };
}

export async function loadClientInfoForCommande(commandeId: string): Promise<DocClientInfo> {
  const { data } = await supabase
    .from("commandes")
    .select("client_id")
    .eq("commande_id", commandeId)
    .maybeSingle();
  return loadClientDocInfo(data?.client_id);
}

export async function loadClientInfoForProforma(proformaId: string): Promise<DocClientInfo> {
  const { data } = await supabase
    .from("proformas")
    .select("client_id")
    .eq("proforma_id", proformaId)
    .maybeSingle();
  return loadClientDocInfo(data?.client_id);
}

export async function loadClientInfoForFacture(factureId: string): Promise<DocClientInfo> {
  const { data } = await supabase
    .from("factures")
    .select("client_id, commande_id")
    .eq("facture_id", factureId)
    .maybeSingle();
  if (data?.client_id) return loadClientDocInfo(data.client_id);
  if (data?.commande_id) return loadClientInfoForCommande(data.commande_id);
  return {};
}

export async function loadClientInfoForBL(blId: string): Promise<DocClientInfo> {
  const { data } = await supabase
    .from("bons_livraison")
    .select("commande_id")
    .eq("bl_id", blId)
    .maybeSingle();
  if (!data?.commande_id) return {};
  return loadClientInfoForCommande(data.commande_id);
}

export async function loadClientInfoForBR(brId: string): Promise<DocClientInfo> {
  const { data } = await supabase
    .from("bons_retour")
    .select("facture_id")
    .eq("br_id", brId)
    .maybeSingle();
  if (!data?.facture_id) return {};
  return loadClientInfoForFacture(data.facture_id);
}

export type DocTotals = Pick<
  DocBase,
  | "totalVente"
  | "remiseLigneTotal"
  | "remiseGlobalePct"
  | "remiseGlobale"
  | "montantHT"
  | "tvaPct"
  | "tva"
  | "totalTTC"
> & {
  /** Frais de transport : un seul type possible (livraison OU expédition) ou aucun. */
  fraisTransportType?: "livraison" | "expedition" | null;
  fraisTransportMontant?: number;
};

export async function loadCommandeTotals(commandeId: string): Promise<DocTotals> {
  const { data } = await supabase
    .from("commandes")
    .select(
      "total_ht_brut, total_remises_lignes, total_ht_net, remise_globale_pct, remise_globale_montant, taux_tva, montant_tva, montant_ttc, net_a_payer, montant_total",
    )
    .eq("commande_id", commandeId)
    .maybeSingle();
  if (!data) return {};
  const brut = Number(data.total_ht_brut ?? 0);
  const remiseLigne = Number(data.total_remises_lignes ?? 0);
  const remiseGlobale = Number(data.remise_globale_montant ?? 0);
  const ht = Number(data.total_ht_net ?? brut - remiseLigne - remiseGlobale);
  const tvaPct = 0;
  const tva = 0;
  const ttc = ht;
  return {
    totalVente: brut || undefined,
    remiseLigneTotal: remiseLigne || undefined,
    remiseGlobalePct: Number(data.remise_globale_pct ?? 0) || undefined,
    remiseGlobale: remiseGlobale || undefined,
    montantHT: ht || undefined,
    tvaPct: tvaPct || undefined,
    tva: tva || undefined,
    totalTTC: ttc || undefined,
  };
}

export async function loadFactureTotals(factureId: string): Promise<DocTotals> {
  const { data } = await supabase
    .from("factures")
    .select("commande_id, type_frais_transport, montant_frais_transport")
    .eq("facture_id", factureId)
    .maybeSingle();
  if (!data) return {};
  const base = data.commande_id ? await loadCommandeTotals(data.commande_id) : {};
  const type = (data.type_frais_transport as "livraison" | "expedition" | null) ?? null;
  const frais = Number(data.montant_frais_transport ?? 0);
  if (!type || frais <= 0) return base;
  const ttc = Number(base.totalTTC ?? base.montantHT ?? 0);
  return {
    ...base,
    fraisTransportType: type,
    fraisTransportMontant: frais,
    totalTTC: ttc + frais,
  };
}

export async function loadProformaTotals(proformaId: string): Promise<DocTotals> {
  const { data } = await supabase
    .from("proformas")
    .select("commande_id")
    .eq("proforma_id", proformaId)
    .maybeSingle();
  if (!data?.commande_id) return {};
  return loadCommandeTotals(data.commande_id);
}

export type DiscountMode = 'A' | 'B' | 'NONE';

export function resolveDiscountMode(totals: DocTotals): DiscountMode {
  if (totals.remiseGlobale && totals.remiseGlobale > 0) return 'B';
  if (totals.remiseLigneTotal && totals.remiseLigneTotal > 0) return 'A';
  return 'NONE';
}

export async function loadClientInfoForAchat(achatId: string): Promise<DocClientInfo> {
  const { data } = await supabase
    .from("achats")
    .select("fournisseur_id, reference_fournisseur")
    .eq("achat_id", achatId)
    .maybeSingle();
  if (!data?.fournisseur_id) return {};
  const { data: fournisseur } = await supabase
    .from("fournisseurs")
    .select("nom, reference, representant, telephone, email, adresse, ville")
    .eq("fournisseur_id", data.fournisseur_id)
    .maybeSingle();
  if (!fournisseur) return {};
  return {
    clientNom: fournisseur.nom || "",
    codeClient: fournisseur.reference,
    representant: fournisseur.representant,
    clientTel: fournisseur.telephone,
    emailClient: fournisseur.email,
    adresseClient: fournisseur.adresse,
    villeClient: fournisseur.ville,
    modePaiement: data.reference_fournisseur ? `Réf. Fournisseur: ${data.reference_fournisseur}` : undefined,
  };
}

export async function loadAchatTotals(achatId: string): Promise<DocTotals> {
  const { data } = await supabase
    .from("achats")
    .select("montant_brut, total_remises_lignes, remise_globale_pct, remise_globale_montant, montant_ht_net, montant_ttc, montant")
    .eq("achat_id", achatId)
    .maybeSingle();
  if (!data) return {};
  
  const brut = Number(data.montant_brut ?? data.montant ?? 0);
  const remiseLigneTotal = Number(data.total_remises_lignes ?? 0);
  const remiseGlobale = Number(data.remise_globale_montant ?? 0);
  const remiseGlobalePct = Number(data.remise_globale_pct ?? 0);
  const net = Number(data.montant_ht_net ?? data.montant_ttc ?? data.montant ?? (brut - remiseLigneTotal - remiseGlobale));

  return {
    totalVente: brut,
    remiseLigneTotal: remiseLigneTotal,
    remiseGlobalePct: remiseGlobalePct,
    remiseGlobale: remiseGlobale,
    montantHT: net,
    totalTTC: net,
  };
}

export async function loadClientInfoForSpecimen(specimenId: string): Promise<DocClientInfo> {
  const { data } = await supabase
    .from("specimens")
    .select("client_id")
    .eq("specimen_id", specimenId)
    .maybeSingle();
  return loadClientDocInfo(data?.client_id);
}
