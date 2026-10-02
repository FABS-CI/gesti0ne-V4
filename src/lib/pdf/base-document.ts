import { formatDocumentReference } from "@/lib/document-reference";

import { PDFString, PDFName, PDFArray } from "pdf-lib";
import {
  PDFDocument,
  degrees,
  rgb,
  StandardFonts,
  type PDFPage,
  type PDFFont,
  type PDFImage,
  type RGB,
} from "pdf-lib";
import fabsLogoUrl from "@/assets/fabs-logo.png";
import { formatFCFA, formatDate } from "@/lib/format";

/** Toutes les dates des documents ERP : JJ/MM/AAAA */
const formatDocDate = (d: string) => {
  if (!d) return "—";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) return d;
  const out = formatDate(d);
  return out === "—" ? d : out;
};
import { buildQrUrl, QR_COLOR_OPTS } from "./qr-logic";

// --- Configuration & Couleurs ---

export const COLORS = {
  bleuFabs: rgb(0.106, 0.165, 0.341), // #1B2A57
  rougeFabs: rgb(0.827, 0.184, 0.184), // #D32F2F (Couleur pour Remises)
  orangeFabs: rgb(0.96, 0.486, 0.0), // #F57C00
  orangeStatut: rgb(0.961, 0.620, 0.043), // #F59E0B (statut de paiement)
  bleuElectrique: rgb(0, 0.341, 1), // #0057FF (séparation TOTAL À PAYER)
  bleuTampon: rgb(0, 0.141, 0.753), // #0024C0 (bleu du tampon Comptabilité)
  grisClair: rgb(0.968, 0.968, 0.968), // #F7F7F7
  orangeZebra: rgb(1, 0.953, 0.878), // #FFF3E0 (Orange très clair pour zebra)
  noir: rgb(0, 0, 0),
  blanc: rgb(1, 1, 1),
  grisTexte: rgb(0.3, 0.3, 0.3),
  grisLigne: rgb(0.82, 0.835, 0.86),
};

/** Palette « Modèle F » — réservée au corps des documents (jamais en-tête / pied / cadre). */
export const BODY = {
  orange: rgb(0.976, 0.451, 0.086), // #F97316
  nuit: rgb(0.122, 0.2, 0.329), // #1F3354
  ardoise: rgb(0.31, 0.349, 0.408), // #4F5968
  grisClair: rgb(0.957, 0.965, 0.976), // #F4F6F9
  bord: rgb(0.851, 0.871, 0.898), // #D9DEE5
  peche: rgb(1, 0.941, 0.882), // #FFF0E1
  creme: rgb(1, 0.973, 0.941), // #FFF8F0
  filetCreme: rgb(0.953, 0.851, 0.749), // #F3D9BF
  blanc: rgb(1, 1, 1),
};

type Radii = number | { tl?: number; tr?: number; br?: number; bl?: number };

/** Rectangle à coins arrondis (x, y = coin bas-gauche, comme drawRectangle). */
export function roundedRect(
  page: PDFPage,
  x: number,
  y: number,
  w: number,
  h: number,
  r: Radii,
  opts: { color?: RGB; borderColor?: RGB; borderWidth?: number } = {},
) {
  const lim = Math.min(w, h) / 2;
  const c = (v?: number) => Math.max(0, Math.min(lim, v ?? 0));
  const R = typeof r === "number" ? { tl: r, tr: r, br: r, bl: r } : r;
  const tl = c(R.tl), tr = c(R.tr), br = c(R.br), bl = c(R.bl);
  // Coordonnées SVG : origine en haut à gauche, y vers le bas.
  const d = [
    `M ${tl} 0`, `L ${w - tr} 0`, `Q ${w} 0 ${w} ${tr}`,
    `L ${w} ${h - br}`, `Q ${w} ${h} ${w - br} ${h}`,
    `L ${bl} ${h}`, `Q 0 ${h} 0 ${h - bl}`,
    `L 0 ${tl}`, `Q 0 0 ${tl} 0`, "Z",
  ].join(" ");
  page.drawSvgPath(d, {
    x,
    y: y + h,
    color: opts.color,
    borderColor: opts.borderColor,
    borderWidth: opts.borderColor ? opts.borderWidth ?? 0.6 : undefined,
  });
}

/** Colonnes numériques : alignées à droite (en-tête et valeurs). */
export const NUMERIC_KEYS = [
  'qte', 'qte_fact', 'qte_ret', 'prixUnit', 'remisePct', 'remPct', 'montantHT', 'pu',
  'net', 'total', 'montant', 'debit', 'credit', 'retour', 'solde',
];

export const PAGE = { w: 595.28, h: 841.89 }; // A4
export const MARGINS = { x: 34, top: 40, bottom: 65 };
/** Plus bas point autorisé pour un bloc de contenu (au-dessus du trait du pied de page, y=70). */
export const CONTENT_BOTTOM = 80; // Marges internes du contenu
export const CONTENT_W = PAGE.w - MARGINS.x * 2;

// --- Types ---

export type DocBase = {
  id: string; // UUID pour verification
  type: string;
  reference: string;
  date: string;
  heure?: string;
  commercial?: string;
  statut?: string;
  notes?: string;
  observations?: string;
  clientNom?: string | null;
  clientTel?: string | null;
  representant?: string | null;
  demandeurNom?: string | null;
  valide_compta_par_nom?: string | null;
  valide_compta_at?: string | null;
  lignes?: any[];
  certification?: {
    statut: string | null;
    verification_url: string | null;
    token?: string | null;
    canonical_hash?: string | null;
    version?: number | null;
    certified_at?: string | null;
  } | null;
  client: {
    nom: string;
    ville?: string;
    adresse?: string;
    representant?: string;
    telephone?: string;
    email?: string;
    code?: string;
    modePaiement?: string;
  };
};

export type DocLigne = {
  num: number;
  code: string;
  designation: string;
  classe?: string;
  qte: number;
  pu: number;
  remisePct?: number;
  total: number;
};

export type DocTotals = {
  sousTotal: number;
  remiseLignes?: number;
  remiseLignesPct?: number;
  remiseGlobale?: number;
  remiseGlobalePct?: number;
  tva?: number;
  frais?: number;
  /** Libellé de la ligne de frais (ex. « FRAIS DE LIVRAISON »). Défaut : « FRAIS ». */
  fraisLabel?: string;
  totalAPayer: number;
  montantLettres: string;
};

// --- Engine ---

export class BaseDocument {
  doc!: PDFDocument;
  page!: PDFPage;
  fonts!: {
    regular: PDFFont;
    bold: PDFFont;
    italic: PDFFont;
    boldItalic: PDFFont;
  };
  logoImg: PDFImage | null = null;
  data: DocBase;
  totals: DocTotals;
  
  constructor(data: DocBase, totals: DocTotals) {
    this.data = data;
    this.totals = totals;
  }

  async init() {
    this.doc = await PDFDocument.create();
    
    // Charger les polices
    this.fonts = {
      regular: await this.doc.embedFont(StandardFonts.Helvetica),
      bold: await this.doc.embedFont(StandardFonts.HelveticaBold),
      italic: await this.doc.embedFont(StandardFonts.HelveticaOblique),
      boldItalic: await this.doc.embedFont(StandardFonts.HelveticaBoldOblique),
    };

    // Charger le logo
    try {
      const res = await fetch(fabsLogoUrl);
      const bytes = await res.arrayBuffer();
      this.logoImg = await this.doc.embedPng(bytes);
    } catch (e) {
      // Ignored: logo missing is not critical for generation
    }

    this.addNewPage();
  }

  addNewPage() {
    this.page = this.doc.addPage([PAGE.w, PAGE.h]);
    this.drawChrome();
  }

  // Dessine les éléments répétés sur chaque page (cadre, filigrane, header, footer)
  drawChrome() {
    this.drawFrame();
    this.drawWatermark();
    this.drawPaidStamp();
    this.drawHeader();
    this.drawFooter();
  }

  drawFrame() {
    this.page.drawRectangle({
      x: 10,
      y: 10,
      width: PAGE.w - 20,
      height: PAGE.h - 20,
      borderColor: COLORS.bleuElectrique,
      borderWidth: 0.8,
    });
  }

  drawWatermark() {
    if (!this.logoImg) return;
    const size = 300;
    this.page.drawImage(this.logoImg, {
      x: (PAGE.w - size) / 2,
      y: (PAGE.h - size) / 2,
      width: size,
      height: size,
      opacity: 0.05,
    });
  }

  /** Tampon financier visible uniquement sur les factures entièrement réglées. */
  drawPaidStamp() {
    const paiement = (this.data as any).paiement as { statut?: string } | undefined;
    if (this.data.type !== "Facture" || paiement?.statut !== "PAYÉE") return;

    const label = "PAYÉ";
    const angle = 16;
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const side = 200;
    const color = COLORS.bleuTampon;

    // Repère local du tampon (origine = coin bas-gauche du cadre), pivoté de `angle`.
    // Positionné sous le bloc des totaux : ne recouvre ni le tableau des
    // articles, ni les montants, ni le QR code.
    const cx = PAGE.w / 2 - 55;
    const cy = 290;

    const ox = cx - (side / 2) * cos + (side / 2) * sin;
    const oy = cy - (side / 2) * sin - (side / 2) * cos;
    const toPage = (lx: number, ly: number) => ({
      x: ox + lx * cos - ly * sin,
      y: oy + lx * sin + ly * cos,
    });

    // Double liseré : cadre extérieur épais + cadre intérieur fin.
    const frames: Array<{ inset: number; thickness: number; opacity: number }> = [
      { inset: 0, thickness: 5, opacity: 0.2 },
      { inset: 9, thickness: 1.6, opacity: 0.16 },
    ];
    frames.forEach((f) => {
      const p = toPage(f.inset, f.inset);
      this.page.drawRectangle({
        x: p.x,
        y: p.y,
        width: side - f.inset * 2,
        height: side - f.inset * 2,
        borderColor: color,
        borderWidth: f.thickness,
        borderOpacity: f.opacity,
        opacity: 0,
        rotate: degrees(angle),
      });
    });

    // Texte : plusieurs passes très légèrement décalées pour un rendu d'encre irrégulier.
    const size = 62;
    const labelW = this.fonts.bold.widthOfTextAtSize(label, size);
    const lx = (side - labelW) / 2;
    const ly = (side - size * 0.72) / 2;
    const passes = [
      { dx: 0, dy: 0, opacity: 0.2 },
      { dx: 0.9, dy: 0.7, opacity: 0.09 },
      { dx: -0.8, dy: -0.6, opacity: 0.07 },
    ];
    passes.forEach((p) => {
      const pt = toPage(lx + p.dx, ly + p.dy);
      this.page.drawText(label, {
        x: pt.x,
        y: pt.y,
        size,
        font: this.fonts.bold,
        color,
        opacity: p.opacity,
        rotate: degrees(angle),
      });
    });
  }


  drawHeader() {
    const yTop = PAGE.h - 25;
    const isListeProduits = this.data.type === "LISTE DES PRODUITS";

    // Logo (G)
    if (this.logoImg) {
      const h = 45;
      const w = (this.logoImg.width / this.logoImg.height) * h;
      this.page.drawImage(this.logoImg, { x: MARGINS.x, y: yTop - h, width: w, height: h });

      if (!isListeProduits) {
        this.page.drawText("Une innovation pour une école de qualité", {
          x: MARGINS.x,
          y: yTop - h - 12,
          size: 8,
          font: this.fonts.bold,
          color: COLORS.noir,
        });
      }
    }

    // Titre (C)
    let displayType = this.data.type === "Commande" ? "BON DE COMMANDE" : this.data.type.toUpperCase();
    if (this.data.type === "Reçu de Paiement") displayType = "REÇU DE PAIEMENT";
    const titleSize = 28;
    const titleW = this.fonts.bold.widthOfTextAtSize(displayType, titleSize);
    this.page.drawText(displayType, {
      x: (PAGE.w - titleW) / 2,
      y: yTop - 28,
      size: titleSize,
      font: this.fonts.bold,
      color: COLORS.noir,
    });

    // Le statut de paiement n'est plus affiché sous le titre (mention retirée
    // à la demande de l'utilisateur) : il reste visible dans le tableau des
    // totaux et sur la page publique de vérification.

    // Cartouche (D)
    const cartX = PAGE.w - MARGINS.x - 110;
    const cartY = yTop;
    
    const isStatement = this.data.type === "Relevé de Compte";

    if (!isStatement) {
      const shownRef = formatDocumentReference(this.data.reference);
      const refText =
        shownRef.startsWith('|') ||
        shownRef.includes('-') ||
        shownRef.includes('_') ||
        /^[A-Z]{2,3}$/.test(shownRef)
          ? `N° ${shownRef}`
          : shownRef;
      this.page.drawRectangle({
        x: cartX,
        y: cartY - 18,
        width: 110,
        height: 18,
        borderColor: COLORS.bleuElectrique,
        borderWidth: 0.8,
      });
      const refW = this.fonts.bold.widthOfTextAtSize(refText, 9);
      this.page.drawText(refText, {
        x: cartX + (110 - refW) / 2,
        y: cartY - 12,
        size: 9,
        font: this.fonts.bold,
        color: COLORS.noir,
      });
    }

    const details = [
      { l: "Date", v: formatDocDate(this.data.date) },
      { l: "Heure", v: this.data.heure ?? new Date().toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' }) },
    ];
    
    if (this.data.type === "Bon de Réception" && this.data.statut) {
      details.push({ l: "Statut", v: this.data.statut });
    }

    const detailsTop = isStatement ? cartY - 8 : cartY - 32;

    details.forEach((d, i) => {
      const y = detailsTop - i * 15;
      this.page.drawText(`${d.l} :`, { x: cartX + 15, y, size: 11, font: this.fonts.regular, color: COLORS.noir });
      const valW = this.fonts.bold.widthOfTextAtSize(d.v, 12);
      this.page.drawText(d.v, { x: PAGE.w - MARGINS.x - valW, y, size: 12, font: this.fonts.bold, color: COLORS.noir });
    });

    this.page.drawLine({
      start: { x: MARGINS.x, y: yTop - 70 },
      end: { x: PAGE.w - MARGINS.x, y: yTop - 70 },
      color: COLORS.bleuElectrique,
      thickness: 0.8,
    });
  }

  drawFooter() {
    const yBot = 50;

    this.page.drawLine({
      start: { x: MARGINS.x, y: 70 },
      end: { x: PAGE.w - MARGINS.x, y: 70 },
      thickness: 0.8,
      color: COLORS.bleuElectrique,
    });
    
    const colW = CONTENT_W / 3;
    const footerTextSize = 8;
    
    const isListeProduits = this.data.type === "LISTE DES PRODUITS";
    if (!isListeProduits) {
      this.page.drawText("EDITIONS FABS-CI", { x: MARGINS.x, y: yBot, size: footerTextSize + 1, font: this.fonts.bold });
      this.page.drawText("BP 673 Bingerville - Côte d'Ivoire", { x: MARGINS.x, y: yBot - 10, size: footerTextSize, font: this.fonts.regular });
      this.page.drawText("RCCM : CI-ABJ-2020-B-12345", { x: MARGINS.x, y: yBot - 19, size: footerTextSize, font: this.fonts.regular });
      this.page.drawText("NCC : 2302562N", { x: MARGINS.x, y: yBot - 28, size: footerTextSize, font: this.fonts.regular });
    }

    const cx = MARGINS.x + colW;
    this.page.drawText("CONTACT", { x: cx, y: yBot, size: footerTextSize + 1, font: this.fonts.bold });
    this.page.drawText("Tél : +225 07 59 73 71 23 / 01 50 48 51 88", { x: cx, y: yBot - 10, size: footerTextSize, font: this.fonts.regular });
    const emailLabel = "Email : ";
    const labelW = this.fonts.regular.widthOfTextAtSize(emailLabel, footerTextSize);
    const mail1 = "edition693fabs@gmail.com /";
    const mail2 = "info@editions-fabsci.net";
    this.page.drawText(emailLabel, { x: cx, y: yBot - 19, size: footerTextSize, font: this.fonts.regular });
    this.page.drawText(mail1, { x: cx + labelW, y: yBot - 19, size: footerTextSize, font: this.fonts.regular });
    this.page.drawText(mail2, { x: cx + labelW, y: yBot - 28, size: footerTextSize, font: this.fonts.regular });
    this.addMailtoLink("edition693fabs@gmail.com", cx + labelW, yBot - 19, footerTextSize);
    this.addMailtoLink(mail2, cx + labelW, yBot - 28, footerTextSize);

    this.page.drawText("BANQUES", { x: MARGINS.x + colW * 2, y: yBot, size: footerTextSize + 1, font: this.fonts.bold });
    this.page.drawText("CORIS BANK: 01011 007630824101 34", { x: MARGINS.x + colW * 2, y: yBot - 10, size: footerTextSize, font: this.fonts.regular });
    this.page.drawText("SGBCI: 01123012343259990 95", { x: MARGINS.x + colW * 2, y: yBot - 19, size: footerTextSize, font: this.fonts.regular });

  }

  /** Rend une adresse cliquable (lien mailto) sans afficher « mailto: ». */
  addMailtoLink(email: string, x: number, y: number, size: number) {
    try {
      const w = this.fonts.regular.widthOfTextAtSize(email, size);
      const ctx = this.doc.context;
      const annot = ctx.obj({
        Type: "Annot", Subtype: "Link", Rect: [x, y - 2, x + w, y + size],
        Border: [0, 0, 0],
        A: { Type: "Action", S: "URI", URI: PDFString.of(`mailto:${email}`) },
      });
      const ref = ctx.register(annot);
      const annots = this.page.node.lookup(PDFName.of("Annots"));
      if (annots instanceof PDFArray) annots.push(ref);
      else this.page.node.set(PDFName.of("Annots"), ctx.obj([ref]));
    } catch { /* lien facultatif */ }
  }

  /** Numérotation « Page x / N » posée une fois toutes les pages créées. */
  private paginated = false;
  drawPagination() {
    if (this.paginated) return;
    this.paginated = true;
    const pages = this.doc.getPages();
    pages.forEach((pg, i) => {
      const paginText = `Page ${i + 1} / ${pages.length}`;
      const paginW = this.fonts.regular.widthOfTextAtSize(paginText, 8);
      pg.drawText(paginText, { x: PAGE.w - MARGINS.x - paginW, y: 15, size: 8, font: this.fonts.regular, color: COLORS.grisTexte });
    });
  }

  async drawClientAndQr(y: number): Promise<number> {
    const isBR = this.data.type === "Bon de Réception";
    const grandBloc =
      this.data.type === "Facture" ||
      this.data.type === "Proforma" ||
      this.data.type === "Commande" ||
      this.data.type === "Bon de Livraison";
    const boxH = grandBloc ? 118 : 90;
    const boxW = (CONTENT_W - 15) / 2;
    const { shouldShowQr } = await import("./docTypeConfig");
    const prefix = this.data.reference.split('-')[0];
    const qrAutorise =
      this.data.type === "Facture" ||
      this.data.type === "Proforma" ||
      this.data.type === "Commande";
    const avecQr = qrAutorise && shouldShowQr(prefix);
    // Cadre unique (Modèle F) ; séparateur fin entre client et certification.
    roundedRect(this.page, MARGINS.x, y - boxH, avecQr ? CONTENT_W : boxW, boxH, 6, {
      color: BODY.grisClair, borderColor: BODY.bord, borderWidth: 0.6,
    });
    if (avecQr) {
      const sx = MARGINS.x + boxW + 7.5;
      this.page.drawLine({ start: { x: sx, y: y - 8 }, end: { x: sx, y: y - boxH + 8 }, color: BODY.bord, thickness: 0.6 });
    }
    const isBL = this.data.type === "Bon de Livraison";
    const isCommande = this.data.type === "Commande";
    // Bon de commande : pas d'entête "FACTURÉ À", le bloc démarre par le client
    if (!isCommande) {
      this.page.drawText(isBR ? "FOURNISSEUR" : isBL ? "CLIENT" : "FACTURÉ À", { x: MARGINS.x + 10, y: y - 18, size: grandBloc ? 9 : 7, font: this.fonts.bold, color: BODY.ardoise });
    }
    // Nom du client : retour à la ligne propre + réduction automatique si très long,
    // toujours contenu dans la moitié gauche (jamais de chevauchement avec le QR).
    const nomMaxW = boxW - 20;
    const nomTexte = this.data.client.nom.toUpperCase();
    let nomSize = grandBloc ? 14 : 12;
    let nomLignes = this.wrapText(nomTexte, nomMaxW, nomSize, this.fonts.bold);
    while (nomLignes.length > 2 && nomSize > 9) {
      nomSize -= 1;
      nomLignes = this.wrapText(nomTexte, nomMaxW, nomSize, this.fonts.bold);
    }
    nomLignes = nomLignes.slice(0, 2);
    const nomY = y - (isCommande ? 28 : 38);
    nomLignes.forEach((ligne, i) => {
      this.page.drawText(ligne, {
        x: MARGINS.x + 10,
        y: nomY - i * (nomSize + 2),
        size: nomSize,
        font: this.fonts.bold,
        color: BODY.nuit,
      });
    });

    const kv = [
      { l: "Ville", v: this.data.client.ville ?? "—" },
      { l: "Représentant", v: this.data.client.representant ?? "—" },
      { l: "Téléphone", v: this.data.client.telephone ?? "—" },
    ];
    if (this.data.client.modePaiement) {
      kv.push({ l: "Paiement", v: this.data.client.modePaiement });
    }
    const grandTexte = grandBloc;
    const labelSize = grandTexte ? 9 : 8;
    const valueSize = grandTexte ? 10 : 8;
    const valueX = MARGINS.x + (grandTexte ? 92 : 80);
    const valueMaxW = MARGINS.x + boxW - 10 - valueX;
    const extraNom = (nomLignes.length - 1) * (nomSize + 2);
    let lineY = y - (grandTexte ? 58 : 48) - extraNom;
    const minY = y - boxH + 8;
    kv.forEach((item) => {
      const valeurs = this.wrapText(item.v || "—", valueMaxW, valueSize, this.fonts.bold).slice(0, 2);
      if (lineY < minY) return;
      this.page.drawText(`${item.l} :`, { x: MARGINS.x + 10, y: lineY, size: labelSize, font: this.fonts.bold, color: BODY.ardoise });
      valeurs.forEach((v, j) => {
        this.page.drawText(v, {
          x: valueX,
          y: lineY - j * (valueSize + 2),
          size: valueSize,
          font: this.fonts.bold,
          color: BODY.nuit,
        });
      });
      lineY -= (grandTexte ? 15 : 11) + (valeurs.length - 1) * (valueSize + 2);
    });


    if (avecQr) {
      const qrX = MARGINS.x + boxW + 15;

      try {
        const { default: QRCode } = await import("qrcode");

        // Jeton d'authenticité stable : réutilisé à chaque impression / téléchargement.
        const { ensureVerificationSafe, isCertificationActive } = await import(
          "@/lib/certification/auto-certify"
        );
        // La page publique fournit une certification déjà contrôlée côté serveur.
        // Elle ne possède volontairement aucune session ERP et ne doit donc jamais
        // rappeler la fonction de certification authentifiée.
        const cert = this.data.certification ?? await ensureVerificationSafe(this.data.reference);
        const url =
          cert?.verification_url ??
          (cert?.token ? buildQrUrl(cert.token) : buildQrUrl(this.data.reference));
        const qrDataUrl = await QRCode.toDataURL(url, {
          margin: 1,
          width: 240,
          color: QR_COLOR_OPTS,
        });
        const qrImage = await this.doc.embedPng(qrDataUrl);
        const qrSize = 80;
        // Zone blanche autour du QR pour garantir la lecture au scan
        roundedRect(this.page, qrX + 8, y - boxH + 14, qrSize + 8, qrSize + 8, 4, {
          color: BODY.blanc, borderColor: BODY.bord, borderWidth: 0.6,
        });
        this.page.drawImage(qrImage, { x: qrX + 12, y: y - boxH + 18, width: qrSize, height: qrSize });

        // --- Bloc « Certification numérique » (certification automatique idempotente) ---
        const textX = qrX + qrSize + 24;
        const textMaxW = qrX + boxW - 10 - textX;

        this.page.drawText("CERTIFICATION", {
          x: textX,
          y: y - 22,
          size: 7.5,
          font: this.fonts.bold,
          color: BODY.ardoise,
        });

        // Factures, Proformas et Bons de commande : QR + mention seulement
        // (pas de lignes techniques Statut / Version / Date / Empreinte).
        const masquerDetailsCert =
          this.data.type === "Facture" ||
          this.data.type === "Proforma" ||
          this.data.type === "Commande";

        const mentionScan = (yScan: number, texte: string) => {
          this.wrapText(texte, textMaxW, 6.5).forEach((ligne, i) => {
            this.page.drawText(ligne, {
              x: textX,
              y: yScan - i * 9,
              size: 6.5,
              font: this.fonts.regular,
              color: COLORS.grisTexte,
            });
          });
        };

        if (cert && isCertificationActive(cert.statut)) {
          if (masquerDetailsCert) {
            this.page.drawText("DOCUMENT AUTHENTIQUE", {
              x: textX,
              y: y - 36,
              size: 8,
              font: this.fonts.bold,
              color: BODY.nuit,
            });
          }
          if (!masquerDetailsCert) {
            const dateFr = cert.certified_at
              ? new Date(cert.certified_at).toLocaleDateString("fr-FR")
              : "—";
            const hash = cert.canonical_hash ?? "";
            const hashCourt = hash ? `${hash.slice(0, 8).toUpperCase()}…${hash.slice(-4).toUpperCase()}` : "—";
            const lignesCert = [
              `Statut : ACTIVE`,
              `Version : ${cert.version ?? 1}`,
              `Date : ${dateFr}`,
              `Empreinte : ${hashCourt}`,
            ];
            lignesCert.forEach((txt, i) => {
              this.page.drawText(txt, {
                x: textX,
                y: y - 34 - i * 10,
                size: 6.5,
                font: this.fonts.regular,
                color: COLORS.grisTexte,
              });
            });
          }
          mentionScan(
            masquerDetailsCert ? y - 54 : y - 78,
            isCommande ? "Scanner pour authentifier ce document" : "Scanner pour vérifier ce document",
          );
        } else {
          if (!masquerDetailsCert) {
            this.page.drawText("Certification en attente", {
              x: textX,
              y: y - 36,
              size: 6.5,
              font: this.fonts.regular,
              color: COLORS.grisTexte,
            });
          }
          mentionScan(masquerDetailsCert ? y - 36 : y - 50, "Scanner pour vérifier ce document");
        }
      } catch (e) {
        console.error("QR Error", e);
      }
    }

    return y - boxH - 20;
  }

  drawTable(y: number, colonnes: { label: string, key: string, width: number }[], lignes: DocLigne[], options?: { showClientReception?: boolean }): number {
    const drawColLines = (top: number, bottom: number, w = 0.5) => {
      let vx = MARGINS.x;
      [0, ...colonnes.map((c) => c.width)].forEach((cw, idx) => {
        vx += cw;
        const edge = idx === 0 || idx === colonnes.length;
        this.page.drawLine({ start: { x: vx, y: top }, end: { x: vx, y: bottom }, color: BODY.bord, thickness: edge ? 0.6 : w });
      });
    };
    // En-tête : unique aplat bleu électrique du document, titres blancs gras.
    const drawTableHeader = (hy: number) => {
      this.page.drawRectangle({ x: MARGINS.x, y: hy - 20, width: CONTENT_W, height: 20, color: BODY.ardoise });
      let hx = MARGINS.x;
      colonnes.forEach((col, idx) => {
        if (idx > 0) this.page.drawLine({ start: { x: hx, y: hy }, end: { x: hx, y: hy - 20 }, color: COLORS.blanc, thickness: 0.5, opacity: 0.5 });
        const txt = col.label.toUpperCase();
        const txtW = this.fonts.bold.widthOfTextAtSize(txt, 8.5);
        const headerX = NUMERIC_KEYS.includes(col.key) ? hx + col.width - txtW - 5 : hx + 5;
        this.page.drawText(txt, { x: headerX, y: hy - 13.5, size: 8.5, font: this.fonts.bold, color: COLORS.blanc });
        hx += col.width;
      });
    };
    drawTableHeader(y);

    let curY = y - 20;
    const fontSize = 10;
    const colHPadding = 5;

    lignes.forEach((l, i) => {
      let maxRowH = 22;
      const wrapResults = new Map<string, string[]>();

      colonnes.forEach(col => {
        let val = (l as any)[col.key];
        if (typeof val === 'number' && col.key !== 'num' && col.key !== 'qte' && col.key !== 'remisePct') {
          val = formatFCFA(val, false);
        } else if (col.key === 'remisePct' && val) {
          val = `${val} %`;
        }
        val = String(val ?? "");
        
        const availableW = col.width - colHPadding * 2;
        const wrapped = this.wrapText(val, availableW, fontSize);
        wrapResults.set(col.key, wrapped);
        
        const lineH = fontSize * 1.2;
        const textH = wrapped.length * lineH;
        const neededH = textH + 8;
        if (neededH > maxRowH) maxRowH = neededH;
      });

      if (curY - maxRowH < MARGINS.bottom + 20) {
        this.addNewPage();
        curY = PAGE.h - 120;
        drawTableHeader(curY);
        curY -= 20;
      }
      
      const rowH = maxRowH;

      // Zébrage bleu électrique très léger (~5 %), continu d'une page à l'autre.
      if (i % 2 === 1) {
        this.page.drawRectangle({ x: MARGINS.x, y: curY - rowH, width: CONTENT_W, height: rowH, color: BODY.grisClair });
      }
      drawColLines(curY, curY - rowH);

      let curX = MARGINS.x;
      colonnes.forEach(col => {
        const wrapped = wrapResults.get(col.key) || [];
        const lineH = fontSize * 1.2;
        
        wrapped.forEach((lineText, lineIdx) => {
          const txtW = this.fonts.regular.widthOfTextAtSize(lineText, fontSize);
          
          let alignX = curX + colHPadding;
          if (NUMERIC_KEYS.includes(col.key)) {
            alignX = curX + col.width - txtW - colHPadding;
          }

          this.page.drawText(lineText, {
            x: alignX,
            y: curY - 14 - lineIdx * lineH,
            size: fontSize,
            font: this.fonts.regular,
            color: BODY.nuit,
          });
        });
        curX += col.width;
      });

      this.page.drawLine({
        start: { x: MARGINS.x, y: curY - rowH },
        end: { x: MARGINS.x + CONTENT_W, y: curY - rowH },
        color: BODY.bord,
        thickness: i === lignes.length - 1 ? 0.6 : 0.5,
      });

      curY -= rowH;
    });

    return curY;
  }

  wrapText(text: string, width: number, fontSize: number, font?: PDFFont): string[] {
    if (!text) return [""];
    const f = font ?? this.fonts.regular;
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine + " " + word;
      const testW = f.widthOfTextAtSize(testLine, fontSize);
      if (testW <= width) {
        currentLine = testLine;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  }

  /** Hauteur à garder sous la mention finale (ex. tampon) pour que récap + tampon restent sur la même page. */
  reserveAfterTotals = 0;

  drawTotals(y: number): number {
    const isListeProduits = this.data.type === "LISTE DES PRODUITS";
    if (isListeProduits) return y;

    const boxW = 240;
    const x = PAGE.w - MARGINS.x - boxW;
    let curY = y - 10;

    const paiement = (this.data as any).paiement as
      | { montantPaye: number; resteAPayer: number }
      | undefined;

    const rows: Array<{ label: string; value: number; color?: typeof COLORS.noir }> = [
      { label: "SOUS-TOTAL HT", value: this.totals.sousTotal },
    ];

    if (this.totals.remiseLignes && this.totals.remiseLignes > 0) {
      rows.push({ label: "REMISE SUR LIGNES", value: -this.totals.remiseLignes });
    }
    if (this.totals.remiseGlobale && this.totals.remiseGlobale > 0) {
      rows.push({ label: "REMISE GLOBALE", value: -this.totals.remiseGlobale });
    }
    if (this.totals.frais && this.totals.frais > 0) {
      rows.push({ label: this.totals.fraisLabel || "FRAIS", value: this.totals.frais });
    }
    if (this.totals.tva && this.totals.tva > 0) {
      rows.push({ label: "TVA", value: this.totals.tva });
    }

    const payRows: typeof rows = [];
    if (this.data.type === "Facture" && paiement) {
      const paye = Math.max(0, paiement.montantPaye || 0);
      payRows.push({ label: "MONTANT PAYÉ", value: paye });
      payRows.push({ label: "RESTE À PAYER", value: Math.max(0, this.totals.totalAPayer - paye) });
    }

    // Modèle F : carte crème, bandeau TOTAL orange plein.
    const ROW_H = 18, TOTAL_H = 30, PAD = 4, BAND_H = 26;

    // Hauteur réelle : cadre des totaux + mention « Arrêté… » (aucun saut au milieu)
    const mentionText = `Arrêté le présent document à la somme de : ${this.totals.montantLettres}`;
    const mentionLines = this.wrapText(mentionText, CONTENT_W - 4, 9.5, this.fonts.bold);
    const boxH = PAD + rows.length * ROW_H + PAD + TOTAL_H + payRows.length * ROW_H;
    const blockH = boxH + 16 + mentionLines.length * 9.5 * 1.3 + 4 + this.reserveAfterTotals;
    if (curY - blockH < CONTENT_BOTTOM) {
      this.addNewPage();
      curY = PAGE.h - 120;
    }

    const boxTop = curY;
    roundedRect(this.page, x, boxTop - boxH, boxW, boxH, 6, { color: BODY.creme });
    curY = boxTop - PAD;

    const drawRow = (row: (typeof rows)[number], idx = 0, style?: { labelColor: RGB; valueColor: RGB; bold?: boolean }) => {
      if (idx > 0 && !style) {
        this.page.drawLine({ start: { x: x + 8, y: curY }, end: { x: x + boxW - 8, y: curY }, color: BODY.filetCreme, thickness: 0.4 });
      }
      const ty = curY - 12;
      let labelX = x + 8;
      const lblFont = style?.bold ? this.fonts.bold : this.fonts.regular;
      this.page.drawText(row.label, { x: labelX, y: ty, size: 8, font: lblFont, color: style?.labelColor ?? BODY.ardoise });
      if (row.label === "REMISE GLOBALE" && this.totals.sousTotal > 0 && this.totals.remiseGlobale) {
        const rawPct = this.totals.remiseGlobalePct ?? (this.totals.remiseGlobale / this.totals.sousTotal) * 100;
        const pct = parseFloat(rawPct.toFixed(10));
        labelX += lblFont.widthOfTextAtSize(row.label, 8) + 4;
        this.page.drawText(`(${pct} %)`, { x: labelX, y: ty, size: 8, font: this.fonts.bold, color: BODY.ardoise });
      }
      const val = `${formatFCFA(row.value, false)} FCFA`;
      const valW = this.fonts.bold.widthOfTextAtSize(val, 9);
      this.page.drawText(val, {
        x: x + boxW - valW - 8,
        y: ty,
        size: 9,
        font: this.fonts.bold,
        color: style?.valueColor ?? BODY.nuit,
      });
      curY -= ROW_H;
    };
    rows.forEach((r, i) => drawRow(r, i));
    curY -= PAD;
    this.page.drawLine({ start: { x: x + 8, y: curY }, end: { x: x + boxW - 8, y: curY }, color: BODY.filetCreme, thickness: 0.6 });

    // TOTAL À PAYER : bandeau orange plein, coins arrondis.
    const bandY = curY - (TOTAL_H + BAND_H) / 2;
    roundedRect(this.page, x + 6, bandY, boxW - 12, BAND_H, 4, { color: BODY.orange });
    this.page.drawText("TOTAL À PAYER (FCFA)", { x: x + 12, y: bandY + 9.5, size: 9, font: this.fonts.bold, color: BODY.blanc });
    const totalVal = `${formatFCFA(this.totals.totalAPayer, false)} FCFA`;
    const totalW = this.fonts.bold.widthOfTextAtSize(totalVal, 15);
    this.page.drawText(totalVal, { x: x + boxW - totalW - 12, y: bandY + 8, size: 15, font: this.fonts.bold, color: BODY.blanc });
    curY -= TOTAL_H;

    payRows.forEach((r, i) => {
      const isReste = r.label === "RESTE À PAYER";
      if (isReste) {
        const last = i === payRows.length - 1;
        roundedRect(this.page, x, curY - ROW_H, boxW, ROW_H, last ? { bl: 6, br: 6 } : 0, { color: BODY.grisClair });
      }
      drawRow(r, 1, isReste
        ? { labelColor: BODY.nuit, valueColor: BODY.nuit, bold: true }
        : { labelColor: BODY.ardoise, valueColor: BODY.nuit });
    });

    roundedRect(this.page, x, curY, boxW, boxTop - curY, 6, { borderColor: BODY.bord, borderWidth: 0.6 });
    curY -= 16;

    const fontSize = 9.5;
    const wrappedLines = mentionLines;
    
    
    wrappedLines.forEach((line, idx) => {
      this.page.drawText(line, {
        x: MARGINS.x,
        y: curY - (idx * (fontSize * 1.3)),
        size: fontSize,
        font: this.fonts.bold,
        color: COLORS.noir
      });
    });

    return curY - (wrappedLines.length * (fontSize * 1.3)) - 10;
  }

  drawNotes(y: number): number {
    const notes = this.data.notes || this.data.observations;
    if (!notes) return y;

    let curY = y - 10;
    
    // Check if we have enough space for the header
    if (curY < MARGINS.bottom + 40) {
      this.addNewPage();
      curY = PAGE.h - 120;
    }

    this.page.drawText("NOTES / OBSERVATIONS :", {
      x: MARGINS.x,
      y: curY,
      size: 8,
      font: this.fonts.bold,
      color: BODY.nuit
    });
    this.page.drawLine({ start: { x: MARGINS.x, y: curY - 4 }, end: { x: MARGINS.x + CONTENT_W, y: curY - 4 }, color: BODY.bord, thickness: 0.5 });
    curY -= 15;

    const wrapped = this.wrapText(notes, CONTENT_W, 9);
    wrapped.forEach(line => {
      if (curY < MARGINS.bottom + 20) {
        this.addNewPage();
        curY = PAGE.h - 120;
      }
      this.page.drawText(line, { x: MARGINS.x, y: curY, size: 9, font: this.fonts.regular, color: BODY.ardoise });
      curY -= 12;
    });

    return curY - 10;
  }

  drawSignatures(y: number) {
    const boxW = 150;
    let curY = y - 60;
    
    // Ensure we don't draw signatures too low
    if (curY < MARGINS.bottom + 60) {
      this.addNewPage();
      curY = PAGE.h - 180;
    }
    
    roundedRect(this.page, MARGINS.x, curY - 60, boxW, 60, 6, { borderColor: BODY.bord, borderWidth: 0.6 });
    this.page.drawText("LA COMPTABILITÉ", { x: MARGINS.x + 5, y: curY - 12, size: 8, font: this.fonts.bold, color: BODY.nuit });
  }

  async getBytes() {
    this.drawPagination();
    return await this.doc.save();
  }

  async getBlob() {
    const bytes = await this.getBytes();
    return new Blob([bytes as any], { type: "application/pdf" });
  }
}
