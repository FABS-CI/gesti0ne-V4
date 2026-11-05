// Construction du DocBase pour la génération du Bon de Retour PDF.
// Enrichit chaque ligne avec le prix unitaire (facture liée ou produit) et
// remonte les infos client complètes.
import { supabase } from "@/integrations/supabase/client";
import type { DocBase, DocLigne } from "./fabsTemplates";
import { loadClientDocInfo } from "./enrich-lignes";
import { getRetour, type RetourWithLignes } from "@/lib/retours-api";
import { retourLineAmounts } from "@/lib/retour-document-data";

async function loadPrixMap(
  factureId: string | null,
  produitIds: string[],
): Promise<Map<string, { prix: number; remisePct: number; quantiteFacturee: number }>> {
  const prices = new Map<string, { prix: number; remisePct: number; quantiteFacturee: number }>();

  // 1) Prix + remise vendus sur la facture liée (via la commande)
  if (factureId) {
    const { data: fac, error: factureError } = await supabase
      .from("factures")
      .select("commande_id")
      .eq("facture_id", factureId)
      .maybeSingle();
    if (factureError) throw factureError;
    if (fac?.commande_id) {
      const { data: lignes, error: lignesError } = await supabase
        .from("commande_lignes")
        .select("produit_id, prix_unitaire, remise_pct, quantite")
        .eq("commande_id", fac.commande_id);
      if (lignesError) throw lignesError;
      for (const l of (lignes ?? []) as Array<{
        produit_id: string | null;
        prix_unitaire: number | null;
        remise_pct: number | null;
        quantite: number | null;
      }>) {
        if (l.produit_id && l.prix_unitaire != null) {
          prices.set(l.produit_id, {
            prix: Number(l.prix_unitaire),
            remisePct: Number(l.remise_pct ?? 0),
            quantiteFacturee: Number(l.quantite ?? 0),
          });
        }
      }
    }
  }

  // 2) Fallback : prix de vente courant du produit (sans remise)
  const missing = factureId ? [] : produitIds.filter((id) => !prices.has(id));
  if (missing.length > 0) {
    const { data: prods } = await supabase
      .from("produits")
      .select("produit_id, prix_vente")
      .in("produit_id", missing);
    for (const p of (prods ?? []) as Array<{
      produit_id: string;
      prix_vente: number | null;
    }>) {
      if (p.prix_vente != null)
        prices.set(p.produit_id, { prix: Number(p.prix_vente), remisePct: 0, quantiteFacturee: 0 });
    }
  }
  return prices;
}

async function loadProduitsMeta(
  ids: string[],
): Promise<Map<string, { cycle?: string; niveau?: string; matiere?: string; reference?: string }>> {
  const map = new Map<string, { cycle?: string; niveau?: string; matiere?: string; reference?: string }>();
  if (ids.length === 0) return map;
  const { data } = await supabase
    .from("produits")
    .select("produit_id, categorie, niveau, matiere, reference")
    .in("produit_id", ids);
  for (const p of (data ?? []) as Array<{
    produit_id: string;
    categorie: string | null;
    niveau: string | null;
    matiere: string | null;
    reference: string | null;
  }>) {
    map.set(p.produit_id, {
      cycle: (p.categorie ?? "").toUpperCase() || undefined,
      niveau: p.niveau ?? undefined,
      matiere: p.matiere ?? undefined,
      reference: p.reference ?? undefined,
    });
  }
  return map;
}

export async function buildRetourDocBase(retourId: string): Promise<DocBase> {
  const retour = await getRetour(retourId);
  if (!retour) throw new Error("Retour introuvable");
  return buildRetourDocBaseFrom(retour);
}

export async function buildRetourDocBaseFrom(retour: RetourWithLignes): Promise<DocBase> {
  const produitIds = Array.from(
    new Set(retour.lignes.map((l) => l.produit_id).filter((v): v is string => !!v)),
  );
  const [prices, meta, clientInfo] = await Promise.all([
    loadPrixMap(retour.facture_id, produitIds),
    loadProduitsMeta(produitIds),
    loadClientDocInfo(retour.client_id),
  ]);

  let totalBrut = 0;
  let remiseLigneTotal = 0;
  let totalHT = 0;
  const remiseGlobalePct = Number(retour.remise_globale_pct ?? 0);
  const lignes: DocLigne[] = retour.lignes.map((l) => {
    const info = l.produit_id ? prices.get(l.produit_id) : undefined;
    
    // Un retour dérivé d'une facture reprend toujours son prix et sa remise effectifs.
    // Le catalogue n'est utilisé que pour les anciens retours sans facture liée.
    const pu = l.prix_unitaire == null ? (info?.prix ?? 0) : Number(l.prix_unitaire);
    // La ligne du retour est l'enregistrement historique du calcul réellement appliqué.
    // Les données de facture servent de repli aux anciens enregistrements incomplets.
    const remisePct = l.remise_pct == null ? (info?.remisePct ?? 0) : Number(l.remise_pct);
    
    const qte = Number(l.quantite ?? 0);
    const amounts = retourLineAmounts({ prix: pu, quantite: qte, remisePct, remiseGlobalePct,
      remiseMontant: l.remise_montant, totalLigne: l.total_ligne });
    const { brut, remiseLigne: remiseMontant, net: montant } = amounts;
    
    totalBrut += brut;
    remiseLigneTotal += remiseMontant;
    totalHT += amounts.netAvantGlobale;
    const m = l.produit_id ? meta.get(l.produit_id) : undefined;
    return {
      codeArticle: l.reference_produit ?? m?.reference ?? undefined,
      reference: l.designation,
      cycle: m?.cycle,
      niveau: m?.niveau,
      matiere: m?.matiere,
      qteCommandee: info?.quantiteFacturee ?? (retour.facture_id ? undefined : Number(l.quantite_demandee ?? l.quantite ?? 0)),
      qteRetournee: Number(l.quantite_recue ?? l.quantite ?? 0),
      motif: l.motif ?? undefined,
      prixUnitaire: pu || undefined,
      remisePct: amounts.remiseEffectivePct,
      remiseMontant: amounts.remiseEffectiveMontant,
      montant: montant || undefined,
      etatProduit: l.etat_produit ?? undefined,
      etatReception: l.etat_reception ?? undefined,
      commentaireReception: l.commentaire_reception ?? undefined,
    };
  });

  // Remise globale reprise de la facture d'origine (conservée comme remise globale, pas répartie sur les lignes).
  const remiseGlobale = totalHT * remiseGlobalePct / 100;
  const totalNet = totalHT - remiseGlobale;

  // Priorité aux infos saisies sur le retour, fallback sur la fiche client
  const base: any = {
    id: retour.retour_id,
    reference: retour.numero || retour.reference,
    date: retour.date_retour,
    clientNom: retour.etablissement || retour.client_nom || clientInfo.clientNom || null,
    clientTel: retour.telephone || clientInfo.clientTel || null,
    representant: retour.representant_nom || clientInfo.representant || null,
    representantTel: clientInfo.representantTel || null,
    codeClient: clientInfo.codeClient ?? null,
    adresseClient: retour.adresse || clientInfo.adresseClient || null,
    villeClient: retour.ville || clientInfo.villeClient || null,
    communeClient: clientInfo.communeClient || null,
    paysClient: clientInfo.paysClient || null,
    emailClient: clientInfo.emailClient || null,
    ncc: clientInfo.ncc || null,
    lignes,
    totalVente: totalBrut || 0,
    remiseLigneTotal: remiseLigneTotal || 0,
    remiseGlobale: remiseGlobale || 0,
    remiseGlobalePct: remiseGlobalePct || 0,
    montantHT: totalNet || 0,
    totalTTC: totalNet || 0,
    montantTotalStocke: Number(retour.montant),
    statut: retour.statut,
    observations: retour.observations || retour.notes,
    demandeurNom: retour.created_by_nom,
    valide_compta_par_nom: retour.valide_compta_par_nom,
    valide_compta_at: retour.valide_compta_at,
    receptionne_par_nom: retour.receptionne_par_nom,
    receptionne_at: retour.receptionne_at,
  };

  // Enrichissement Documents d'origine
  if (retour.commande_id || retour.facture_id || retour.livraison_id) {
    const fac = retour.facture_id
      ? await supabase.from("factures").select("reference, date_facture, commande_id, client_nom").eq("facture_id", retour.facture_id).maybeSingle()
      : { data: null, error: null };
    if (fac.error) throw fac.error;
    const commandeId = fac.data?.commande_id ?? retour.commande_id;
    const cmd = commandeId
      ? await supabase.from("commandes").select("reference, date_commande, commercial_nom, representant_nom, telephone, ville, adresse").eq("commande_id", commandeId).maybeSingle()
      : { data: null, error: null };
    if (cmd.error) throw cmd.error;
    const bl = retour.livraison_id
      ? await supabase.from("bons_livraison").select("reference, created_at").eq("bl_id", retour.livraison_id).maybeSingle()
      : commandeId
        ? await supabase.from("bons_livraison").select("reference, created_at").eq("commande_id", commandeId).order("created_at", { ascending: true }).limit(1).maybeSingle()
        : { data: null, error: null };
    if (bl.error) throw bl.error;
    base.representant = cmd.data?.commercial_nom || cmd.data?.representant_nom || base.representant;
    base.clientTel = retour.telephone || cmd.data?.telephone || base.clientTel;
    base.adresseClient = retour.adresse || cmd.data?.adresse || base.adresseClient;
    base.villeClient = retour.ville || cmd.data?.ville || base.villeClient;
    base.origin = {
      cmd: cmd.data ? { ref: cmd.data.reference, date: cmd.data.date_commande } : null,
      fac: fac.data ? { ref: fac.data.reference, date: fac.data.date_facture } : null,
      bl: bl.data ? { ref: bl.data.reference, date: bl.data.created_at } : null,
    };
  }

  // Enrichissement Dépôt
  if (retour.depot_id) {
    const { data: depot } = await supabase
      .from("depots")
      .select("nom, code, adresse, ville, responsable, telephone")
      .eq("depot_id", retour.depot_id)
      .maybeSingle();
    base.depot = depot || null;
  }

  return base;
}
