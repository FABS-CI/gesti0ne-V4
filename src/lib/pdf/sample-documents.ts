// Données fictives pour l'aperçu des thèmes (Administration › Apparence des documents).
// Aucune écriture en base, aucun numéro consommé, aucun QR valide.
import type { RecapThemeId } from "./recap-themes";

export type SampleDocType =
  | "facture"
  | "proforma"
  | "bon_commande"
  | "bon_livraison"
  | "avoir"
  | "bon_retour"
  | "recu"
  | "releve";

export type SamplePayment = "aucun" | "partiel" | "solde";

export const SAMPLE_DOC_TYPES: { id: SampleDocType; label: string }[] = [
  { id: "facture", label: "Facture" },
  { id: "proforma", label: "Proforma" },
  { id: "bon_commande", label: "Bon de commande" },
  { id: "bon_livraison", label: "Bon de livraison" },
  { id: "avoir", label: "Avoir" },
  { id: "bon_retour", label: "Bon de retour" },
  { id: "recu", label: "Reçu" },
  { id: "releve", label: "Relevé" },
];

const LIGNES = [
  {
    codeArticle: "FABS-CI92",
    designation: "Mon Livret de Révision CM2",
    qte: 351,
    prixUnitaire: 3000,
  },
  {
    codeArticle: "FABS-CI54",
    designation: "Mon Livret de Révision CM1",
    qte: 251,
    prixUnitaire: 3000,
  },
  {
    codeArticle: "FABS-CI15",
    designation: "Réussir mes Sujets de Composition CM2",
    qte: 150,
    prixUnitaire: 2500,
  },
  {
    codeArticle: "FABS-CI08",
    designation: "Réussir mes Sujets de Composition CM1",
    qte: 1000,
    prixUnitaire: 2500,
  },
].map((l) => ({ ...l, reference: l.designation, remisePct: 0, montant: l.qte * l.prixUnitaire }));

export const SAMPLE_SOUS_TOTAL = LIGNES.reduce((s, l) => s + l.montant, 0);
export const SAMPLE_REMISE_PCT = 30;
export const SAMPLE_REMISE = Math.round((SAMPLE_SOUS_TOTAL * SAMPLE_REMISE_PCT) / 100);
export const SAMPLE_TOTAL = SAMPLE_SOUS_TOTAL - SAMPLE_REMISE;

const TODAY = new Date().toISOString().slice(0, 10);
/** Identifiant factice : le QR ne mène à aucun document. */
const FAKE_CERT = { verification_url: "APERCU-DOCUMENT-FICTIF", token: null, statut: "APERCU" };

const COMMERCIAL_LABEL: Record<string, string> = {
  facture: "Facture",
  proforma: "Proforma",
  bon_commande: "Commande",
  bon_livraison: "Bon de Livraison",
  avoir: "Avoir",
  bon_retour: "Bon de Retour",
};

export async function generateSamplePdf(
  type: SampleDocType,
  theme: RecapThemeId,
  payment: SamplePayment = "aucun",
): Promise<Blob> {
  const gen = await import("./unified-generator");
  const client = {
    clientNom: "GOUIBOU",
    villeClient: "Toumodi",
    representant: "Zaza",
    codeClient: "CL-APERCU",
  };

  if (type === "recu") {
    return gen.generateUnifiedReceiptPDF({
      id: "apercu",
      reference: "APERÇU",
      date: TODAY,
      ...client,
      factureReference: "APERÇU",
      factureMontantTotal: SAMPLE_TOTAL,
      factureMontantPayeAvant: 0,
      totalTTC: Math.round(SAMPLE_TOTAL / 2),
      modePaiement: "Espèces",
      certification: FAKE_CERT,
      recapThemeOverride: theme,
    } as never);
  }

  if (type === "releve") {
    const paye = Math.round(SAMPLE_TOTAL / 2);
    return gen.generateUnifiedStatementPDF({
      reference: "APERÇU",
      recapThemeOverride: theme,
      certification: FAKE_CERT,
      client: { nom: "GOUIBOU", reference: "CL-APERCU", ville: "Toumodi", representant: "Zaza" },
      periodeDebut: TODAY.split("-").reverse().join("/"),
      periodeFin: TODAY.split("-").reverse().join("/"),
      lignes: [
        {
          date: TODAY,
          reference: "APERÇU",
          libelle: "Facture (exemple)",
          debit: SAMPLE_TOTAL,
          credit: 0,
          type: "Facture",
          soldeProgressif: SAMPLE_TOTAL,
        },
        {
          date: TODAY,
          reference: "APERÇU",
          libelle: "Paiement (exemple)",
          debit: 0,
          credit: paye,
          type: "Paiement",
          soldeProgressif: SAMPLE_TOTAL - paye,
        },
      ],
      totalDebit: SAMPLE_TOTAL,
      totalPaiement: paye,
      totalRetours: 0,
      solde: SAMPLE_TOTAL - paye,
    });
  }

  const montantPaye =
    payment === "solde" ? SAMPLE_TOTAL : payment === "partiel" ? Math.round(SAMPLE_TOTAL * 0.4) : 0;
  return gen.generateUnifiedCommercialPDF(
    COMMERCIAL_LABEL[type] as never,
    {
      id: "apercu",
      reference: "APERÇU",
      date: TODAY,
      ...client,
      lignes:
        type === "bon_retour"
          ? LIGNES.map((l) => ({ ...l, qteCommandee: l.qte, qteRetournee: Math.ceil(l.qte / 10) }))
          : LIGNES,
      totalVente: SAMPLE_SOUS_TOTAL,
      remiseGlobale: SAMPLE_REMISE,
      remiseGlobalePct: SAMPLE_REMISE_PCT,
      montantTotalStocke: SAMPLE_TOTAL,
      paiement: type === "facture" ? { totalAPayer: SAMPLE_TOTAL, montantPaye } : undefined,
      certification: FAKE_CERT,
      recapThemeOverride: theme,
    } as never,
  );
}
