// Données du Bon de Réception (approvisionnement), partagées par la fiche et la liste
// des approvisionnements : les deux boutons produisent exactement le même PDF.
import type { Achat, AchatLigne } from "@/lib/achats-api";
import type { DocBase } from "@/lib/pdf/fabsTemplates";

type LignePdf = Pick<
  AchatLigne,
  "reference_produit" | "designation" | "quantite" | "prix_unitaire" | "remise_pct" | "total_ligne"
> & { produits?: unknown };

/** Code article de secours lu sur le produit joint, quand la ligne n'en a pas. */
const codeProduit = (produits: unknown) =>
  (produits as { reference?: string | null } | null | undefined)?.reference || undefined;

export function buildAchatPdfData(achat: Achat, lignes: LignePdf[]): DocBase {
  // Totaux recalculés depuis les lignes (Audit points 7 et 10) : sous-total brut, puis
  // remise sur lignes, pour que la remise apparaisse en colonne et dans le récapitulatif.
  const totalBrut = lignes.reduce((s, l) => s + Number(l.quantite) * Number(l.prix_unitaire), 0);
  const totalRemiseLignes = lignes.reduce(
    (s, l) => s + (Number(l.quantite) * Number(l.prix_unitaire) * Number(l.remise_pct ?? 0)) / 100,
    0,
  );
  const remisePctMoyenne = totalBrut > 0 ? (totalRemiseLignes / totalBrut) * 100 : 0;
  const net = totalBrut - totalRemiseLignes;

  return {
    id: achat.achat_id,
    br_id: achat.achat_id,
    reference: achat.reference,
    date: achat.date_achat,
    clientNom: achat.fournisseurs?.raison_sociale ?? "—",
    codeClient: achat.fournisseurs?.reference ?? achat.reference_fournisseur ?? undefined,
    clientTel: achat.fournisseurs?.telephone ?? undefined,
    emailClient: achat.fournisseurs?.email ?? undefined,
    adresseClient: achat.fournisseurs?.adresse ?? undefined,
    villeClient: achat.fournisseurs?.ville ?? undefined,
    representant: achat.fournisseurs?.representant ?? undefined,
    modePaiement: achat.reference_fournisseur
      ? `Réf. Fournisseur: ${achat.reference_fournisseur}`
      : undefined,
    lignes: lignes.map((l) => ({
      codeArticle: l.reference_produit || codeProduit(l.produits),
      reference: l.designation,
      qte: Number(l.quantite),
      prixUnitaire: Number(l.prix_unitaire),
      remisePct: Number(l.remise_pct ?? 0),
      montant: Number(l.total_ligne),
    })),
    totalVente: totalBrut,
    remiseLigneTotal: totalRemiseLignes,
    remisePct: remisePctMoyenne,
    remiseGlobalePct: 0,
    remiseGlobale: 0,
    montantHT: net,
    totalTTC: net,
    montant: Number(achat.montant),
    notes: achat.notes ?? undefined,
  };
}
