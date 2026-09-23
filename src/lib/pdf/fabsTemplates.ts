import {
  PDFDocument,
  rgb,
  StandardFonts,
  type PDFPage,
  type PDFFont,
  type PDFImage,
  type RGB,
} from "pdf-lib";
import fabsLogoUrl from "@/assets/fabs-logo.png";
import { generateUnifiedCommercialPDF, generateUnifiedStatementPDF, generateUnifiedAchatPDF, generateUnifiedReceiptPDF } from "./unified-generator";

// ----------------------------------------------------------------------------
// Types partagés par les différents générateurs (exportés pour compatibilité)
// ----------------------------------------------------------------------------

export type DocLigne = {
  num?: number;
  code?: string;
  designation?: string;
  total?: number;
  pu?: number;
  classe?: string;
  cycle?: string;
  niveau?: string;
  matiere?: string;
  codeArticle?: string;
  reference?: string;
  unite?: string;
  qte?: number;
  qteCommandee?: number;
  qteLivree?: number;
  qteRetournee?: number;
  motif?: string;
  prixUnitaire?: number;
  montant?: number;
  remisePct?: number;
  remiseMontant?: number;
  tvaPct?: number;
};

export type DocStatut = {
  label: string;
  color?: string;
};

export type DocBase = {
  id?: string;
  facture_id?: string;
  commande_id?: string;
  proforma_id?: string;
  bl_id?: string;
  br_id?: string;
  reference: string;
  date: string;
  clientNom?: string | null;
  clientTel?: string | null;
  representant?: string | null;
  representantTel?: string | null;
  codeClient?: string | null;
  adresseClient?: string | null;
  villeClient?: string | null;
  communeClient?: string | null;
  paysClient?: string | null;
  emailClient?: string | null;
  ncc?: string | null;
  rccm?: string | null;
  modePaiement?: string | null;
  lignes?: DocLigne[];
  totalVente?: number;
  remisePct?: number;
  remise?: number;
  remiseLigneTotal?: number;
  remiseGlobale?: number;
  remiseGlobalePct?: number;
  montantHT?: number;
  tvaPct?: number;
  tva?: number;
  totalTTC?: number;
  /** Frais de transport : « livraison » OU « expedition », jamais les deux. */
  fraisTransportType?: "livraison" | "expedition" | null;
  fraisTransportMontant?: number;
  /** Certification déjà vérifiée côté serveur, notamment pour un téléchargement public. */
  certification?: {
    statut: string | null;
    verification_url: string | null;
    token?: string | null;
    canonical_hash?: string | null;
    version?: number | null;
    certified_at?: string | null;
  } | null;
  paye?: number;
  soldeDu?: number;
  livreurNom?: string | null;
  dateReceptionClient?: string | null;
  nomReceptionnaireClient?: string | null;
  statut?: DocStatut | null;
  notes?: string | null;
  montant?: number;
  factureReference?: string;
  factureMontantTotal?: number | null;
  factureMontantPayeAvant?: number | null;
  observations?: string | null;
  devise?: string;
  balanceBefore?: number | null;
  demandeurNom?: string | null;
  valide_compta_par_nom?: string | null;
  valide_compta_at?: string | null;
  receptionne_par_nom?: string | null;
  receptionne_at?: string | null;
  origin?: {
    cmd: { ref: string; date: string } | null;
    fac: { ref: string; date: string } | null;
    bl: { ref: string; date: string } | null;
  } | null;
  depot?: {
    nom: string;
    code: string;
    adresse?: string | null;
    ville?: string | null;
    responsable?: string | null;
    telephone?: string | null;
  } | null;
};

export type EtatCompteLigne = {
  date: string;
  reference: string;
  libelle?: string;
  debit?: number;
  credit?: number;
  solde?: number;
  type?: string;
  factureReference?: string;
};

export type EtatCompteAgeing = {
  nonEchu: number;
  j0_30: number;
  j31_60: number;
  j61_90: number;
  j90plus: number;
};

export type EtatCompteData = {
  client_id?: string;
  reference?: string;
  periodeDebut?: string | null;
  periodeFin?: string | null;
  client?: {
    nom: string;
    reference?: string | null;
    adresse?: string | null;
    telephone?: string | null;
    email?: string | null;
    representant?: string | null;
    ville?: string | null;
  };
  lignes: EtatCompteLigne[];
  soldeOuverture?: number;
  ageing?: EtatCompteAgeing | null;
};

export type IncidentLignePdf = {
  numero: number;
  reference: string;
  designation: string;
  quantite: number;
  unite: string;
  valeurUnitaire: number;
  valeurTotale: number;
  observation: string;
};

export type IncidentPdfData = {
  numero: string;
  dateIncident: string;
  heureIncident: string | null;
  depot: string | null;
  magasin: string | null;
  responsable: string | null;
  typeIncident: string;
  statut: { label: string; color: string } | null;
  gravite: string | null;
  declarant: string | null;
  dateDeclaration: string;
  motif: string | null;
  observations: string | null;
  lignes: IncidentLignePdf[];
};

export type RapportIncidentsData = {
  reference: string;
  periodeLabel: string;
  filtresLabel: string | null;
  lignes: any[];
};

// ----------------------------------------------------------------------------
// Export des fonctions de génération
// ----------------------------------------------------------------------------

export async function generateFacturePDF(data: DocBase): Promise<Blob> {
  return generateUnifiedCommercialPDF("Facture", data);
}

export async function generateProformaPDF(data: DocBase): Promise<Blob> {
  return generateUnifiedCommercialPDF("Proforma", data);
}

export async function generateBonCommandePDF(data: DocBase): Promise<Blob> {
  return generateUnifiedCommercialPDF("Commande", data);
}

export async function generateBonLivraisonPDF(data: DocBase): Promise<Blob> {
  return generateUnifiedCommercialPDF("Bon de Livraison", data);
}

export async function generateBonRetourPDF(data: DocBase): Promise<Blob> {
  return generateUnifiedCommercialPDF("Bon de Retour", data);
}

export async function generateBonRemiseSpecimensPDF(data: DocBase): Promise<Blob> {
  return generateUnifiedCommercialPDF("Spécimens", data);
}

export async function generateBonTransfertPDF(data: DocBase): Promise<Blob> {
  return generateUnifiedCommercialPDF("Bon de Livraison", data); // Ou un type spécifique si existant
}

export async function generateEtatCompteClientPDF(data: EtatCompteData): Promise<Blob> {
  return generateUnifiedStatementPDF(data);
}

export async function generateApprovisionnementPDF(data: DocBase): Promise<Blob> {
  return generateUnifiedAchatPDF(data);
}

export async function generateRecuPaiementPDF(data: DocBase): Promise<Blob> {
  return generateUnifiedReceiptPDF(data);
}


// PDF d'incidents — moteur unifié pdf-lib (IncidentDocument / RapportIncidentsDocument)
export async function generateIncidentPDF(data: IncidentPdfData): Promise<Blob> {
  const { IncidentDocument } = await import("./incident-document");
  const doc = new IncidentDocument(
    {
      id: data.numero,
      type: "Fiche d'incident",
      reference: data.numero,
      date: data.dateIncident,
      client: { nom: data.depot ?? "STOCK" },
    } as never,
    data,
  );
  await doc.init();
  await doc.drawContent();
  return await doc.getBlob();
}

export async function generateRapportIncidentsPDF(data: RapportIncidentsData): Promise<Blob> {
  const { RapportIncidentsDocument } = await import("./incident-document");
  const doc = new RapportIncidentsDocument(
    {
      id: data.reference,
      type: "Rapport d'incidents",
      reference: data.reference,
      date: new Date().toISOString(),
      client: { nom: "FABS-CI" },
    } as never,
    data as never,
  );
  await doc.init();
  await doc.drawContent();
  return await doc.getBlob();
}


// ----------------------------------------------------------------------------
// Utilitaires système (Action et QR)
// ----------------------------------------------------------------------------

/** Déclenche le téléchargement direct d'un Blob PDF. */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result ?? "");
      resolve(res.slice(res.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Téléchargement d'un PDF robuste :
 * 1. Pont natif Android (WebView Capacitor) si disponible ;
 * 2. msSaveOrOpenBlob (legacy) ;
 * 3. Ancre <a download> ;
 * 4. Repli : ouverture du blob dans un nouvel onglet (navigateurs mobiles
 *    qui ignorent l'attribut download, ex. Brave/Android).
 */
export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof window === "undefined") return;

  const bridge = (window as any).AndroidFileSaver;
  if (bridge?.saveBase64) {
    blobToBase64(blob)
      .then((b64) => bridge.saveBase64(filename, b64, blob.type || "application/pdf"))
      .catch(() => {
        /* noop */
      });
    return;
  }

  const nav = window.navigator as any;
  if (nav?.msSaveOrOpenBlob) {
    nav.msSaveOrOpenBlob(blob, filename);
    return;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const supportsDownload = "download" in a;
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.target = "_blank";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  if (!supportsDownload) {
    // Certains WebView/navigateurs mobiles ignorent le clic programmé.
    window.open(url, "_blank");
  }

  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Génère un nom de fichier standardisé. */
export function fileNameFor(reference: string, clientNom?: string | null): string {
  const safeRef = reference.replace(/[^a-z0-9]/gi, "_");
  const safeClient = clientNom ? `_${clientNom.replace(/[^a-z0-9]/gi, "_")}` : "";
  return `${safeRef}${safeClient}.pdf`.toUpperCase();
}

/** Build QR payload for verification. */
export function buildQrPayload(data: DocBase): string {
  return JSON.stringify({
    ref: data.reference,
    cli: data.clientNom,
    date: data.date,
    tot: data.totalTTC || data.montantHT,
  });
}
