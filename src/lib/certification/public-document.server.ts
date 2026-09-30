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

const DOWNLOADABLE: DocType[] = ["FACTURE", "PROFORMA", "COMMANDE", "PAIEMENT", "RELEVE"];

export type PublicPdfPayload = {
  docType: DocType;
  label: "Facture" | "Proforma" | "Commande" | "Reçu" | "Relevé";
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

  if (doc.type === "RELEVE") {
    const { data: cli } = await supabaseAdmin
      .from("clients").select("nom, telephone, representant").eq("client_id", doc.id).maybeSingle();
    if (!cli) return null;
    const { loadReleveClient } = await import("@/lib/pdf/releve-data");
    const r = await loadReleveClient(
      { clientId: doc.id, clientNom: cli.nom, clientTel: cli.telephone, representant: cli.representant },
      supabaseAdmin,
    );
    return {
      docType: "RELEVE",
      label: "Relevé",
      reference: result.document.reference,
      date: result.document.date,
      data: {
        ...r,
        client: { ...r.client, reference: r.client.code },
        certification: { verification_url: buildVerificationUrl(verifiedToken) },
      },
    };
  }

  if (doc.type === "PAIEMENT") {
    return buildReceiptPayload(doc.id, verifiedToken, result.document, supabaseAdmin);
  }

  // Résolution de la commande source (factures / proformas s'y rattachent)
  let commandeId: string | null = null;
  let clientId: string | null = null;
  let fraisTransportType: "livraison" | "expedition" | null = null;
  let fraisTransportMontant = 0;
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
      // Facture : le total à payer inclut les frais de transport (source unique
      // de vérité = factures.montant_total = total produits après remises + frais).
      const frais = fraisTransportType && fraisTransportMontant > 0 ? fraisTransportMontant : 0;
      totals = {
        totalVente: brut || undefined,
        remiseLigneTotal: remiseLigne || undefined,
        remiseGlobalePct: Number(t.remise_globale_pct ?? 0) || undefined,
        remiseGlobale: remiseGlobale || undefined,
        montantHT: ht || undefined,
        totalTTC: (ht + frais) || undefined,
        ...(frais > 0
          ? { fraisTransportType, fraisTransportMontant: frais }
          : {}),
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

/** Données du reçu, construites comme dans l'application (mêmes règles de solde). */
async function buildReceiptPayload(
  paiementId: string,
  verifiedToken: string,
  cert: { canonical_hash?: string | null; certified_at?: string | null },
  db: any,
): Promise<PublicPdfPayload | null> {
  const { data: p } = await db.from("paiements").select("*").eq("paiement_id", paiementId).maybeSingle();
  if (!p) return null;
  let facture: any = null;
  let client: any = null;
  let balanceBefore: number | null = null;
  if (p.facture_id) {
    const { data: f } = await db
      .from("factures")
      .select("reference, montant_total, montant_paye, client_id")
      .eq("facture_id", p.facture_id)
      .maybeSingle();
    facture = f;
    if (f) {
      const { data: prev } = await db
        .from("paiements")
        .select("montant")
        .eq("facture_id", p.facture_id)
        .eq("statut", "valide")
        .or(`date_paiement.lt.${p.date_paiement},and(date_paiement.eq.${p.date_paiement},created_at.lt.${p.created_at})`);
      const sum = ((prev as any[]) ?? []).reduce((a, c) => a + Number(c.montant), 0);
      balanceBefore = Number(f.montant_total) - sum;
      if (f.client_id) {
        const { data: c } = await db
          .from("clients")
          .select("reference, nom, telephone, adresse, ville, representant")
          .eq("client_id", f.client_id)
          .maybeSingle();
        client = c;
      }
    }
  }
  if (!client && p.client_nom) {
    const { data: c } = await db
      .from("clients")
      .select("reference, nom, telephone, adresse, ville, representant")
      .eq("nom", p.client_nom)
      .maybeSingle();
    client = c;
  }
  const { data: allocs } = await db.rpc("get_payment_allocations", { _paiement_id: paiementId });
  const invoices = ((allocs as any[]) ?? []).map((a) => ({
    reference: a.reference ?? "—",
    invoiceTotal: Number(a.montant_facture ?? 0),
    amountPaid: Number(a.montant_affecte ?? 0),
  }));
  const { MODE_PAIEMENT_LABEL } = await import("@/lib/paiements-api");
  const totalFacture = facture ? Number(facture.montant_total) : null;
  return {
    docType: "PAIEMENT",
    label: "Reçu",
    reference: p.reference,
    date: p.date_paiement,
    data: {
      id: p.paiement_id,
      reference: p.reference,
      date: p.date_paiement,
      clientNom: client?.nom ?? p.client_nom,
      codeClient: client?.reference ?? null,
      clientTel: client?.telephone ?? null,
      adresseClient: client?.adresse ?? null,
      villeClient: client?.ville ?? null,
      representant: client?.representant ?? null,
      modePaiement: MODE_PAIEMENT_LABEL[p.mode_paiement] ?? p.mode_paiement,
      totalTTC: Number(p.montant),
      factureReference: facture?.reference ?? undefined,
      factureMontantTotal: totalFacture,
      factureMontantPayeAvant:
        totalFacture !== null && balanceBefore !== null ? totalFacture - balanceBefore : null,
      balanceBefore,
      observations: p.notes,
      devise: "FCFA",
      invoices: invoices.length > 1 ? invoices : undefined,
      certification: {
        statut: "AUTHENTIC",
        verification_url: buildVerificationUrl(verifiedToken),
        canonical_hash: cert.canonical_hash ?? null,
        certified_at: cert.certified_at ?? null,
      },
    },
  };
}
