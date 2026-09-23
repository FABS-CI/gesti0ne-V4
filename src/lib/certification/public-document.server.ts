/**
 * Construction serveur du contenu PDF d'un document vérifié publiquement.
 *
 * Sécurité : la charge utile n'est renvoyée que si la vérification
 * cryptographique du jeton (ou de la référence) aboutit à AUTHENTIC et que le
 * document est une Facture, une Proforma ou un Bon de commande. Le client ne
 * fournit jamais l'identifiant du document : il est résolu côté serveur à
 * partir du jeton vérifié.
 */
import {
  buildVerificationUrl,
  verifyByReference,
  verifyByToken,
  loadDocumentData,
  type DocType,
} from "./certification.server";

const DOWNLOADABLE: DocType[] = ["FACTURE", "PROFORMA", "COMMANDE"];

export type PublicPdfPayload = {
  docType: DocType;
  label: "Facture" | "Proforma" | "Commande";
  reference: string;
  date: string | null;
  data: Record<string, unknown>;
};

type Ligne = {
  produit_id: string | null;
  designation: string | null;
  quantite: number | null;
  prix_unitaire: number | null;
  total_ligne: number | null;
  remise_pct?: number | null;
  montant_remise?: number | null;
  reference_produit?: string | null;
};

function toDocLignes(rows: Ligne[], produits: Map<string, any>) {
  return rows.map((r) => {
    const qte = Number(r.quantite ?? 0);
    const pu = Number(r.prix_unitaire ?? 0);
    const remisePct = r.remise_pct != null ? Number(r.remise_pct) : 0;
    const brut = qte * pu;
    const remiseMontant =
      r.montant_remise != null ? Number(r.montant_remise) : Math.round((brut * remisePct) / 100);
    const net = r.total_ligne != null ? Number(r.total_ligne) : brut - remiseMontant;
    const p = r.produit_id ? produits.get(r.produit_id) : null;
    return {
      codeArticle: r.reference_produit ?? p?.reference ?? undefined,
      reference: r.designation ?? undefined,
      cycle: (p?.categorie ?? "").toUpperCase() || undefined,
      niveau: p?.niveau ?? undefined,
      matiere: p?.matiere ?? undefined,
      qte,
      prixUnitaire: pu,
      montant: net,
      remisePct,
      remiseMontant,
    };
  });
}

export async function loadPublicPdfPayload(
  segment: string,
  tokenParam: string | null,
): Promise<PublicPdfPayload | null> {
  let result = await verifyByToken(tokenParam ?? segment);
  if (result.status === "INVALID" && !tokenParam) {
    result = await verifyByReference(segment);
  }
  if (result.status !== "AUTHENTIC") return null;

  const verifiedToken = tokenParam ?? segment;

  const doc = await loadDocumentData(result.document.reference);
  if (!doc || !DOWNLOADABLE.includes(doc.type)) return null;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Résolution de la commande source (factures / proformas s'y rattachent)
  let commandeId: string | null = null;
  let clientId: string | null = null;
  if (doc.type === "COMMANDE") {
    commandeId = doc.id;
    const { data } = await supabaseAdmin
      .from("commandes")
      .select("client_id")
      .eq("commande_id", doc.id)
      .maybeSingle();
    clientId = (data as any)?.client_id ?? null;
  } else if (doc.type === "FACTURE") {
    const { data } = await supabaseAdmin
      .from("factures")
      .select("commande_id, client_id, type_frais_transport, montant_frais_transport")
      .eq("facture_id", doc.id)
      .maybeSingle();
    commandeId = (data as any)?.commande_id ?? null;
    clientId = (data as any)?.client_id ?? null;
    fraisTransportType = ((data as any)?.type_frais_transport ?? null) as typeof fraisTransportType;
    fraisTransportMontant = Number((data as any)?.montant_frais_transport ?? 0);
  } else {
    const { data } = await supabaseAdmin
      .from("proformas")
      .select("commande_id, client_id")
      .eq("proforma_id", doc.id)
      .maybeSingle();
    commandeId = (data as any)?.commande_id ?? null;
    clientId = (data as any)?.client_id ?? null;
  }

  if (!clientId && commandeId) {
    const { data } = await supabaseAdmin
      .from("commandes")
      .select("client_id")
      .eq("commande_id", commandeId)
      .maybeSingle();
    clientId = (data as any)?.client_id ?? null;
  }

  // Lignes
  let rawLignes: Ligne[] = [];
  if (commandeId) {
    const { data } = await supabaseAdmin
      .from("commande_lignes")
      .select(
        "produit_id, designation, quantite, prix_unitaire, total_ligne, remise_pct, montant_remise, reference_produit",
      )
      .eq("commande_id", commandeId);
    rawLignes = ((data as any) ?? []) as Ligne[];
  } else if (doc.type === "PROFORMA") {
    const { data } = await supabaseAdmin
      .from("proforma_lignes")
      .select("produit_id, designation, quantite, prix_unitaire, total_ligne")
      .eq("proforma_id", doc.id);
    rawLignes = ((data as any) ?? []) as Ligne[];
  }

  const produitIds = Array.from(
    new Set(rawLignes.map((l) => l.produit_id).filter((v): v is string => !!v)),
  );
  const produits = new Map<string, any>();
  if (produitIds.length > 0) {
    const { data } = await supabaseAdmin
      .from("produits")
      .select("produit_id, reference, categorie, niveau, matiere")
      .in("produit_id", produitIds);
    for (const p of ((data as any) ?? []) as any[]) produits.set(p.produit_id, p);
  }

  // Client
  let clientInfo: Record<string, unknown> = {};
  if (clientId) {
    const { data } = await supabaseAdmin
      .from("clients")
      .select("reference, nom, representant, telephone, email, adresse, ville, quartier, pays, nif")
      .eq("client_id", clientId)
      .maybeSingle();
    const c = data as any;
    if (c) {
      clientInfo = {
        clientNom: c.nom,
        codeClient: c.reference,
        representant: c.representant,
        representantTel: c.telephone,
        clientTel: c.telephone,
        emailClient: c.email,
        adresseClient: c.adresse,
        villeClient: c.ville,
        communeClient: c.quartier,
        paysClient: c.pays,
        ncc: c.nif,
      };
    }
  }

  // Totaux
  let totals: Record<string, unknown> = {};
  if (commandeId) {
    const { data } = await supabaseAdmin
      .from("commandes")
      .select(
        "total_ht_brut, total_remises_lignes, total_ht_net, remise_globale_pct, remise_globale_montant",
      )
      .eq("commande_id", commandeId)
      .maybeSingle();
    const t = data as any;
    if (t) {
      const brut = Number(t.total_ht_brut ?? 0);
      const remiseLigne = Number(t.total_remises_lignes ?? 0);
      const remiseGlobale = Number(t.remise_globale_montant ?? 0);
      const ht = Number(t.total_ht_net ?? brut - remiseLigne - remiseGlobale);
      totals = {
        totalVente: brut || undefined,
        remiseLigneTotal: remiseLigne || undefined,
        remiseGlobalePct: Number(t.remise_globale_pct ?? 0) || undefined,
        remiseGlobale: remiseGlobale || undefined,
        montantHT: ht || undefined,
        totalTTC: ht || undefined,
      };
    }
  }

  const label =
    doc.type === "FACTURE" ? "Facture" : doc.type === "PROFORMA" ? "Proforma" : "Commande";

  return {
    docType: doc.type,
    label,
    reference: doc.data.reference,
    date: doc.data.date,
    data: {
      id: doc.id,
      reference: doc.data.reference,
      date: doc.data.date,
      clientNom: doc.data.client_nom,
      totalVente: doc.data.montant,
      montantHT: doc.data.montant,
      paiement: doc.data.paiement ?? undefined,
      certification: {
        statut: "AUTHENTIC",
        verification_url: buildVerificationUrl(verifiedToken),
        canonical_hash: result.document.canonical_hash ?? null,
        certified_at: result.document.certified_at ?? null,
      },
      ...clientInfo,
      ...totals,
      lignes: toDocLignes(rawLignes, produits),
    },
  };
}
