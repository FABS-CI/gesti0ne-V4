import { CommercialDocument } from "./commercial-document";
import { StatementDocument } from "./statement-document";
import { ReceiptDocument, type ReceiptData } from "./receipt-document";
import { RetourDocument } from "./retour-document";
import { resolveDiscountMode, type DocTotals as DataTotals } from "./enrich-lignes";
import type { DocBase as DataBase } from "./fabsTemplates";
import { numberToLetters } from "./number-to-letters";
import {
  calculateInvoicePaymentStatus,
  computeInvoicePaymentStatus,
  type InvoicePaymentStatus,
} from "@/lib/factures/payment-status";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * État de paiement à imprimer sur une facture.
 * 1) charge utile déjà calculée côté serveur (page publique de scan QR) ;
 * 2) sinon calcul direct depuis la base via la fonction centrale unique.
 */
async function resolveInvoicePayment(
  id: string,
  data: DataBase,
  totalAPayer: number,
): Promise<InvoicePaymentStatus | null> {
  const fourni = (data as any).paiement;
  if (fourni && typeof fourni === "object") {
    return computeInvoicePaymentStatus(
      fourni.totalAPayer ?? totalAPayer,
      fourni.montantPaye,
    );
  }
  if (!UUID_RE.test(id)) return null;
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    return await calculateInvoicePaymentStatus(id, supabase as never);
  } catch {
    return null;
  }
}



/**
 * Adaptateur pour brancher le nouveau moteur BaseDocument sur les fonctions legacy
 */
export async function generateUnifiedCommercialPDF(
  type: "Facture" | "Proforma" | "Commande" | "Bon de Livraison" | "Avoir" | "Spécimens" | "Bon de Retour",
  data: DataBase
): Promise<Blob> {
  if (type === "Bon de Retour") {
    return generateUnifiedRetourPDF(data);
  }

  const docBase: any = {
    id: (data as any).id || (data as any).facture_id || (data as any).commande_id || (data as any).proforma_id || (data as any).bl_id || (data as any).br_id || "verification-only",
    type: type,
    reference: data.reference,
    date: data.date,
    commercial: (data as any).commercialNom || (data as any).representant || "",
    certification: data.certification ?? null,
    client: {
      nom: data.clientNom || "",
      ville: data.villeClient || "",
      adresse: data.adresseClient || "",
      representant: data.representant || "",
      telephone: data.clientTel || data.representantTel || "",
      email: data.emailClient || "",
      code: data.codeClient || "",
    }
  };

  // Frais de transport : une seule ligne possible (livraison OU expédition), ou aucune.
  const fraisTransportType = (data as any).fraisTransportType as
    | "livraison"
    | "expedition"
    | null
    | undefined;
  const fraisTransportMontant = Number((data as any).fraisTransportMontant ?? 0);
  const hasFraisTransport = Boolean(fraisTransportType) && fraisTransportMontant > 0;

  const totals = {
    sousTotal: data.totalVente || 0,
    remiseLignes: data.remiseLigneTotal || 0,
    remiseGlobale: data.remiseGlobale || data.remise || 0,
    remiseGlobalePct: data.remiseGlobalePct || data.remisePct || 0,
    tva: data.tva || 0,
    frais: hasFraisTransport ? fraisTransportMontant : 0,
    fraisLabel: hasFraisTransport
      ? fraisTransportType === "livraison"
        ? "FRAIS DE LIVRAISON"
        : "FRAIS D'EXPÉDITION"
      : undefined,
    totalAPayer: 0,
    montantLettres: "",
  };
  // Source de vérité unique : SOUS-TOTAL − remises + frais + TVA = TOTAL À PAYER.
  const computedTotal = Math.round(
    totals.sousTotal - totals.remiseLignes - totals.remiseGlobale + totals.frais + totals.tva,
  );
  totals.totalAPayer = totals.sousTotal > 0
    ? Math.max(0, computedTotal)
    : (data.totalTTC || data.montantHT || 0);
  totals.montantLettres = numberToLetters(totals.totalAPayer);

  // Résoudre le paiement avant l'initialisation : l'en-tête et le tampon sont
  // dessinés dès la création de la première page.
  if (type === "Facture") {
    docBase.paiement = await resolveInvoicePayment(docBase.id, data, totals.totalAPayer);
    // Contrôle de cohérence : RESTE = TOTAL − PAYÉ, toujours.
    if (docBase.paiement) {
      const paye = Math.max(0, Number(docBase.paiement.montantPaye) || 0);
      docBase.paiement.montantPaye = paye;
      docBase.paiement.resteAPayer = Math.max(0, totals.totalAPayer - paye);
    }
  }

  const doc = new CommercialDocument(docBase, totals);
  await doc.init();
  
  // Injecter les données spécifiques FABS
  (doc.data as any).lignes = data.lignes || [];
  (doc.data as any).soldeDu = (data as any).soldeDu || (data as any).resteDu || 0;

  // Détection du mode de remise pour le tableau
  const discountMode = resolveDiscountMode({
    remiseLigneTotal: totals.remiseLignes,
    remiseGlobale: totals.remiseGlobale
  } as any);
  doc.setDiscountMode(discountMode);

  await doc.drawContent();
  return await doc.getBlob();
}

/**
 * Adaptateur pour le Bon de Réception (Approvisionnement)
 */
export async function generateUnifiedAchatPDF(
  data: DataBase
): Promise<Blob> {
  const docBase = {
    id: data.br_id || data.id || "achat-id",
    type: "Bon de Réception",
    reference: data.reference,
    date: data.date,
    client: {
      nom: data.clientNom || "",
      ville: data.villeClient || "",
      adresse: data.adresseClient || "",
      representant: data.representant || "",
      telephone: data.clientTel || "",
      email: data.emailClient || "",
      code: data.codeClient || "",
    }
  };

  const totals = {
    sousTotal: data.totalVente || 0,
    remiseLignes: data.remiseLigneTotal || 0,
    remiseLignesPct: data.remisePct || 0,
    remiseGlobale: data.remiseGlobale || 0,
    remiseGlobalePct: data.remiseGlobalePct || 0,
    tva: data.tva || 0,
    totalAPayer: 0,
    montantLettres: "",
  };
  // Source de vérité unique : SOUS-TOTAL − remises + frais + TVA = TOTAL À PAYER.
  const computedTotal = Math.round(
    totals.sousTotal - totals.remiseLignes - totals.remiseGlobale + totals.frais + totals.tva,
  );
  totals.totalAPayer = totals.sousTotal > 0
    ? Math.max(0, computedTotal)
    : (data.totalTTC || data.montantHT || 0);
  totals.montantLettres = numberToLetters(totals.totalAPayer);

  const doc = new CommercialDocument(docBase, totals);
  await doc.init();
  
  (doc.data as any).lignes = data.lignes || [];
  (doc.data as any).notes = data.notes;

  // Détection du mode de remise :
  // Si remise sur lignes > 0, on affiche la colonne Remise (%)
  const discountMode = (totals.remiseLignes && totals.remiseLignes > 0) ? 'A' : 
                      (totals.remiseGlobale && totals.remiseGlobale > 0) ? 'B' : 'NONE';
  doc.setDiscountMode(discountMode);

  await doc.drawContent();
  return await doc.getBlob();
}

/**
 * Génère un relevé de compte avec le nouveau moteur
 */
export async function generateUnifiedStatementPDF(data: any): Promise<Blob> {
  const docBase = {
    id: data.client_id || "statement",
    type: "Relevé de Compte",
    reference: data.reference || "RELEVÉ",
    date: new Date().toISOString(), // On garde l'ISO ici, il sera formaté par BaseDocument.drawHeader

    client: {
      nom: data.client?.nom || "",
      code: data.client?.reference || "",
      telephone: data.client?.telephone || "",
      representant: data.client?.representant || "",
      ville: data.client?.ville || "",
      adresse: data.client?.adresse || "",
      email: data.client?.email || "",
      ncc: data.client?.ncc || "",
    }

  };

  const doc = new StatementDocument(docBase, {} as any);
  await doc.init();
  await doc.drawContent(data);
  return await doc.getBlob();
}

/**
 * Génère un reçu de paiement avec le nouveau moteur ReceiptDocument
 */
export async function generateUnifiedReceiptPDF(data: DataBase): Promise<Blob> {
  const docBase: any = {
    id: data.id || "receipt-id",
    type: "Reçu de Paiement",
    reference: data.reference,
    date: data.date,
    client: {
      nom: data.clientNom || "",
      ville: data.villeClient || "",
      adresse: data.adresseClient || "",
      representant: data.representant || "",
      telephone: data.clientTel || "",
      code: data.codeClient || "",
    },
    balanceBefore: (data as any).balanceBefore, // Transmit historical balance if present
  };

  const receiptData: ReceiptData = {
    paymentNumber: data.reference,
    paymentDate: data.date,
    customerName: data.clientNom || "",
    customerCity: data.villeClient || undefined,
    customerRep: data.representant || undefined,
    customerPhone: data.clientTel || undefined,
    invoiceNumber: data.factureReference || "—",
    invoiceTotal: Number(data.factureMontantTotal ?? 0),
    balanceBefore: data.factureMontantPayeAvant !== null && data.factureMontantTotal !== null
      ? Number(data.factureMontantTotal) - Number(data.factureMontantPayeAvant)
      : Number(data.balanceBefore || data.totalTTC || 0), // Use balanceBefore if provided (historical context)
    amountPaid: Number(data.totalTTC || 0),
    balanceAfter: 0, // Calculated below
    paymentMethod: data.modePaiement || "Espèces",
    paymentReference: (data as any).num_transaction || (data as any).paymentReference || undefined,
    notes: data.notes || undefined,
    invoices: Array.isArray((data as any).invoices)
      ? ((data as any).invoices as any[]).map((i) => ({
          reference: String(i.reference ?? "—"),
          invoiceTotal: Number(i.invoiceTotal ?? 0),
          amountPaid: Number(i.amountPaid ?? 0),
        }))
      : undefined,
  };

  // Re-calculate balance after based on balance before and amount paid
  receiptData.balanceAfter = Math.max(0, receiptData.balanceBefore - receiptData.amountPaid);

  const doc = new ReceiptDocument(docBase, receiptData);
  await doc.init();
  await doc.drawContent();
  return await doc.getBlob();
}

/**
 * Génère un bon de retour avec le nouveau moteur RetourDocument
 */
export async function generateUnifiedRetourPDF(data: DataBase): Promise<Blob> {
  const docBase: any = {
    id: data.id || "retour-id",
    type: "Bon de Retour",
    reference: data.reference,
    date: data.date,
    notes: data.notes || data.observations,
    client: {
      nom: data.clientNom || "",
      ville: data.villeClient || "",
      adresse: data.adresseClient || "",
      representant: data.representant || "",
      telephone: data.clientTel || "",
      code: data.codeClient || "",
    },
    demandeur: (data as any).demandeurNom || (data as any).created_by_nom || "—",
    approuvePar: (data as any).valide_compta_par_nom || (data as any).approuvePar || "—",
    dateApprobation: (data as any).valide_compta_at 
      ? new Date((data as any).valide_compta_at).toLocaleDateString('fr-FR') 
      : (data as any).dateApprobation || "—",
    lignes: data.lignes || []
  };

  const doc = new RetourDocument(docBase, {} as any);
  await doc.init();
  await doc.drawContent();
  return await doc.getBlob();
}
