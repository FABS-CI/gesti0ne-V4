import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  generateBonCommandePDF,
  generateProformaPDF,
  generateFacturePDF,
  generateBonLivraisonPDF,
  downloadBlob,
  fileNameFor,
} from "@/lib/pdf/fabsTemplates";
import {
  loadCommandeDocLignes,
  loadClientInfoForCommande,
  loadCommandeTotals,
} from "@/lib/pdf/enrich-lignes";
import { emailDoc, printBlobAsync, viewBlobAsync } from "@/lib/pdf/actions";
import { getOrCreatePdf, pdfCacheKey } from "@/lib/pdf/pdfCache";
import type { Commande } from "@/lib/commandes-api";
import { friendlyError } from '@/lib/friendly-error';

// ── Proforma ──────────────────────────────────────────────────────────────────

export async function buildProformaBlob(c: Commande) {
  const { data: pro } = await supabase
    .from("proformas")
    .select("proforma_id, reference, date_proforma")
    .eq("commande_id", c.commande_id)
    .maybeSingle();
  if (!pro) {
    toast.error("Aucune proforma liée à cette commande");
    return null;
  }
  const [lignes, clientInfo, totals] = await Promise.all([
    loadCommandeDocLignes(c.commande_id),
    loadClientInfoForCommande(c.commande_id),
    loadCommandeTotals(c.commande_id),
  ]);
  const blob = await generateProformaPDF({
    ...clientInfo,
    ...totals,
    reference: pro.reference,
    date: pro.date_proforma,
    clientNom: clientInfo.clientNom ?? c.client_nom,
    totalVente: totals.totalVente ?? Number(c.montant_total),
    montantHT: totals.montantHT ?? Number(c.montant_total),
    lignes,
  });
  return { blob, reference: pro.reference };
}

export async function downloadProforma(c: Commande) {
  try {
    const built = await buildProformaBlob(c);
    if (!built) return;
    downloadBlob(built.blob, fileNameFor(built.reference, c.client_nom));
  } catch (e) {
    toast.error(friendlyError(e, "Erreur PDF proforma"));
  }
}

export async function printProforma(c: Commande) {
  try {
    await printBlobAsync(
      buildProformaBlob(c).then((b) => {
        if (!b) throw new Error("Aucun document");
        return b.blob;
      }),
    );
  } catch (e) {
    toast.error(friendlyError(e, "Erreur impression"));
  }
}

export async function viewProforma(c: Commande) {
  try {
    await viewBlobAsync(
      buildProformaBlob(c).then((b) => {
        if (!b) throw new Error("Aucun document");
        return b.blob;
      }),
    );
  } catch (e) {
    toast.error(friendlyError(e, "Erreur aperçu"));
  }
}

// ── Bon de commande ───────────────────────────────────────────────────────────

export async function buildBonCommandeBlob(c: Commande) {
  const key = pdfCacheKey(
    "BC",
    c.reference,
    (c as { updated_at?: string }).updated_at ?? c.date_commande,
  );
  const blob = await getOrCreatePdf(key, async () => {
    const [lignes, clientInfo, totals] = await Promise.all([
      loadCommandeDocLignes(c.commande_id),
      loadClientInfoForCommande(c.commande_id),
      loadCommandeTotals(c.commande_id),
    ]);
    return generateBonCommandePDF({
      ...clientInfo,
      ...totals,
      reference: c.reference,
      date: c.date_commande,
      clientNom: clientInfo.clientNom ?? c.client_nom,
      totalVente: totals.totalVente ?? Number(c.montant_total),
      montantHT: totals.montantHT ?? Number(c.montant_total),
      lignes,
    });
  });
  return { blob, reference: c.reference };
}

export async function downloadBonCommande(c: Commande) {
  try {
    const built = await buildBonCommandeBlob(c);
    downloadBlob(built.blob, fileNameFor(built.reference, c.client_nom));
  } catch (e) {
    toast.error(friendlyError(e, "Erreur PDF bon de commande"));
  }
}

export async function printBonCommande(c: Commande) {
  try {
    await printBlobAsync(buildBonCommandeBlob(c).then((b) => b.blob));
  } catch (e) {
    toast.error(friendlyError(e, "Erreur impression"));
  }
}

export async function viewBonCommande(c: Commande) {
  try {
    await viewBlobAsync(buildBonCommandeBlob(c).then((b) => b.blob));
  } catch (e) {
    toast.error(friendlyError(e, "Erreur aperçu"));
  }
}

// ── Facture ───────────────────────────────────────────────────────────────────

export async function buildFactureBlob(c: Commande) {
  const { data: fac } = await supabase
    .from("factures")
    .select("facture_id, reference, date_facture")
    .eq("commande_id", c.commande_id)
    .maybeSingle();
  if (!fac) {
    toast.error("Aucune facture liée");
    return null;
  }
  const [lignes, clientInfo, totals] = await Promise.all([
    loadCommandeDocLignes(c.commande_id),
    loadClientInfoForCommande(c.commande_id),
    loadFactureTotals(fac.facture_id),
  ]);
  const blob = await generateFacturePDF({
    ...clientInfo,
    ...totals,
    id: fac.facture_id,
    facture_id: fac.facture_id,
    reference: fac.reference,
    date: fac.date_facture,
    clientNom: clientInfo.clientNom ?? c.client_nom,
    totalVente: totals.totalVente ?? Number(c.montant_total),
    montantHT: totals.montantHT ?? Number(c.montant_total),
    lignes,
  });
  return { blob, reference: fac.reference };
}

export async function downloadFactureFor(c: Commande) {
  try {
    const built = await buildFactureBlob(c);
    if (!built) return;
    downloadBlob(built.blob, fileNameFor(built.reference, c.client_nom));
  } catch (e) {
    toast.error(friendlyError(e, "Erreur PDF facture"));
  }
}

export async function printFactureFor(c: Commande) {
  try {
    await printBlobAsync(
      buildFactureBlob(c).then((b) => {
        if (!b) throw new Error("Aucun document");
        return b.blob;
      }),
    );
  } catch (e) {
    toast.error(friendlyError(e, "Erreur impression"));
  }
}

export async function viewFactureFor(c: Commande) {
  try {
    await viewBlobAsync(
      buildFactureBlob(c).then((b) => {
        if (!b) throw new Error("Aucun document");
        return b.blob;
      }),
    );
  } catch (e) {
    toast.error(friendlyError(e, "Erreur aperçu"));
  }
}

// ── Bon de livraison ──────────────────────────────────────────────────────────

export async function buildBLBlob(c: Commande) {
  const { data: bl } = await supabase
    .from("bons_livraison")
    .select("reference, date_emission")
    .eq("commande_id", c.commande_id)
    .maybeSingle();
  if (!bl) {
    toast.error("Aucun bon de livraison lié");
    return null;
  }
  const [lignes, clientInfo, totals] = await Promise.all([
    loadCommandeDocLignes(c.commande_id),
    loadClientInfoForCommande(c.commande_id),
    loadCommandeTotals(c.commande_id),
  ]);
  const blob = await generateBonLivraisonPDF({
    ...clientInfo,
    ...totals,
    reference: bl.reference,
    date: bl.date_emission,
    clientNom: clientInfo.clientNom ?? c.client_nom,
    totalVente: totals.totalVente ?? Number(c.montant_total),
    montantHT: totals.montantHT ?? Number(c.montant_total),
    lignes,
  });
  return { blob, reference: bl.reference };
}

export async function downloadBLFor(c: Commande) {
  try {
    const built = await buildBLBlob(c);
    if (!built) return;
    downloadBlob(built.blob, fileNameFor(built.reference, c.client_nom));
  } catch (e) {
    toast.error(friendlyError(e, "Erreur PDF BL"));
  }
}

export async function printBLFor(c: Commande) {
  try {
    await printBlobAsync(
      buildBLBlob(c).then((b) => {
        if (!b) throw new Error("Aucun document");
        return b.blob;
      }),
    );
  } catch (e) {
    toast.error(friendlyError(e, "Erreur impression"));
  }
}

export async function viewBLFor(c: Commande) {
  try {
    await viewBlobAsync(
      buildBLBlob(c).then((b) => {
        if (!b) throw new Error("Aucun document");
        return b.blob;
      }),
    );
  } catch (e) {
    toast.error(friendlyError(e, "Erreur aperçu"));
  }
}

// ── Email ─────────────────────────────────────────────────────────────────────

export function emailCommande(c: Commande) {
  emailDoc({
    subject: `Commande ${c.reference} — FABS-CI`,
    body: `Bonjour,\n\nVeuillez trouver ci-joint les documents relatifs à la commande ${c.reference}.\n\nCordialement,\nFABS-CI`,
  });
}
