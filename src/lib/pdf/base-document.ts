
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
  grisClair: rgb(0.968, 0.968, 0.968), // #F7F7F7
  orangeZebra: rgb(1, 0.953, 0.878), // #FFF3E0 (Orange très clair pour zebra)
  noir: rgb(0, 0, 0),
  blanc: rgb(1, 1, 1),
  grisTexte: rgb(0.3, 0.3, 0.3),
  grisLigne: rgb(0.82, 0.835, 0.86),
};

export const PAGE = { w: 595.28, h: 841.89 }; // A4
export const MARGINS = { x: 34, top: 40, bottom: 65 }; // Marges internes du contenu
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
    this.drawHeader();
    this.drawFooter();
  }

  drawFrame() {
    this.page.drawRectangle({
      x: 10,
      y: 10,
      width: PAGE.w - 20,
      height: PAGE.h - 20,
      borderColor: COLORS.bleuFabs,
      borderWidth: 0.5,
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
      color: COLORS.bleuFabs,
    });

    // Cartouche (D)
    const cartX = PAGE.w - MARGINS.x - 110;
    const cartY = yTop;
    
    const isStatement = this.data.type === "Relevé de Compte";

    if (!isStatement) {
      const refText =
        this.data.reference.includes('-') ||
        this.data.reference.includes('_') ||
        /^[A-Z]{2,3}$/.test(this.data.reference)
          ? `N° ${this.data.reference}`
          : this.data.reference;
      this.page.drawRectangle({
        x: cartX,
        y: cartY - 18,
        width: 110,
        height: 18,
        color: COLORS.bleuFabs,
      });
      const refW = this.fonts.bold.widthOfTextAtSize(refText, 9);
      this.page.drawText(refText, {
        x: cartX + (110 - refW) / 2,
        y: cartY - 12,
        size: 9,
        font: this.fonts.bold,
        color: COLORS.blanc,
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
      color: COLORS.grisLigne,
      thickness: 0.5,
    });
  }

  drawFooter() {
    const yBot = 50;

    this.page.drawLine({
      start: { x: MARGINS.x, y: 70 },
      end: { x: PAGE.w - MARGINS.x, y: 70 },
      thickness: 1,
      color: COLORS.orangeFabs,
    });
    
    const colW = CONTENT_W / 3;
    const footerTextSize = 8;
    
    const isListeProduits = this.data.type === "LISTE DES PRODUITS";
    if (!isListeProduits) {
      this.page.drawText("EDITIONS FABS-CI", { x: MARGINS.x, y: yBot, size: footerTextSize + 1, font: this.fonts.bold });
      this.page.drawText("BP 673 Bingerville - Côte d'Ivoire", { x: MARGINS.x, y: yBot - 10, size: footerTextSize, font: this.fonts.regular });
      this.page.drawText("RCCM : CI-ABJ-2020-B-12345", { x: MARGINS.x, y: yBot - 19, size: footerTextSize, font: this.fonts.regular });
    }

    this.page.drawText("CONTACT", { x: MARGINS.x + colW, y: yBot, size: footerTextSize + 1, font: this.fonts.bold });
    this.page.drawText("Tél: +225 07 59 73 71 23 / 01 50 48 51 88", { x: MARGINS.x + colW, y: yBot - 10, size: footerTextSize, font: this.fonts.regular });
    this.page.drawText("Email: edition693fabs@gmail.com", { x: MARGINS.x + colW, y: yBot - 19, size: footerTextSize, font: this.fonts.regular });

    this.page.drawText("BANQUES", { x: MARGINS.x + colW * 2, y: yBot, size: footerTextSize + 1, font: this.fonts.bold });
    this.page.drawText("CORIS BANK: 01011 007630824101 34", { x: MARGINS.x + colW * 2, y: yBot - 10, size: footerTextSize, font: this.fonts.regular });
    this.page.drawText("SGBCI: 01123012343259990 95", { x: MARGINS.x + colW * 2, y: yBot - 19, size: footerTextSize, font: this.fonts.regular });

    if (this.data.type === "Facture") {
      const warningText = "IMPORTANT : Seuls les paiements effectués sur les numéros officiels indiqués au bloc CONTACT sont valables.";
      const warnY = 75;
      const warnW1 = this.fonts.bold.widthOfTextAtSize(warningText, 8);
      this.page.drawText(warningText, {
        x: MARGINS.x + (CONTENT_W - warnW1) / 2,
        y: warnY + 5,
        size: 8,
        font: this.fonts.bold,
        color: COLORS.rougeFabs,
      });
    }

    const pageCount = this.doc.getPageCount();
    const currPage = this.doc.getPages().indexOf(this.page) + 1;
    const paginText = `Page ${currPage} / ${pageCount}`;
    const paginW = this.fonts.regular.widthOfTextAtSize(paginText, 8);
    this.page.drawText(paginText, {
      x: PAGE.w - MARGINS.x - paginW,
      y: 15,
      size: 8,
      font: this.fonts.regular,
      color: COLORS.grisTexte,
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
    
    this.page.drawRectangle({
      x: MARGINS.x,
      y: y - boxH,
      width: boxW,
      height: boxH,
      color: COLORS.grisClair,
      opacity: 0.5,
    });
    const isBL = this.data.type === "Bon de Livraison";
    const isCommande = this.data.type === "Commande";
    // Bon de commande : pas d'entête "FACTURÉ À", le bloc démarre par le client
    if (!isCommande) {
      this.page.drawText(isBR ? "FOURNISSEUR" : isBL ? "CLIENT" : "FACTURÉ À", { x: MARGINS.x + 10, y: y - 18, size: grandBloc ? 9 : 7, font: this.fonts.bold, color: COLORS.bleuFabs });
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
        color: COLORS.bleuFabs,
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
      this.page.drawText(`${item.l} :`, { x: MARGINS.x + 10, y: lineY, size: labelSize, font: this.fonts.regular });
      valeurs.forEach((v, j) => {
        this.page.drawText(v, {
          x: valueX,
          y: lineY - j * (valueSize + 2),
          size: valueSize,
          font: this.fonts.bold,
        });
      });
      lineY -= (grandTexte ? 15 : 11) + (valeurs.length - 1) * (valueSize + 2);
    });


    const { shouldShowQr } = await import("./docTypeConfig");
    const prefix = this.data.reference.split('-')[0];
    
    // Règle métier : QR Code pour les FACTURES et les PROFORMAS
    // On vérifie à la fois le type explicite ET le préfixe de référence
    const qrAutorise =
      this.data.type === "Facture" ||
      this.data.type === "Proforma" ||
      this.data.type === "Commande";
    if (qrAutorise && shouldShowQr(prefix)) {
      const qrX = MARGINS.x + boxW + 15;
      this.page.drawRectangle({
        x: qrX,
        y: y - boxH,
        width: boxW,
        height: boxH,
        color: COLORS.grisClair,
        opacity: 0.5,
      });

      try {
        const { default: QRCode } = await import("qrcode");

        // Jeton d'authenticité stable : réutilisé à chaque impression / téléchargement.
        const { ensureVerificationSafe, isCertificationActive } = await import(
          "@/lib/certification/auto-certify"
        );
        const cert = await ensureVerificationSafe(this.data.reference);
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
        this.page.drawRectangle({
          x: qrX + 8,
          y: y - boxH + 14,
          width: qrSize + 8,
          height: qrSize + 8,
          color: COLORS.blanc,
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
          color: COLORS.bleuFabs,
        });

        // Factures, Proformas et Bons de commande : QR + mention seulement
        // (pas de lignes techniques Statut / Version / Date / Empreinte).
        const masquerDetailsCert =
          this.data.type === "Facture" ||
          this.data.type === "Proforma" ||
          this.data.type === "Commande";

        if (cert && isCertificationActive(cert.statut)) {
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
          this.page.drawText(
            isCommande ? "Scanner pour authentifier" : "Scanner pour vérifier l'authenticité",
            { x: textX, y: y - boxH + 14, size: 6, font: this.fonts.regular, color: COLORS.grisTexte },
          );
        } else {
          if (!masquerDetailsCert) {
            this.page.drawText("Certification en attente", {
              x: textX,
              y: y - 34,
              size: 6.5,
              font: this.fonts.regular,
              color: COLORS.grisTexte,
            });
          }
          this.page.drawText("Scanner pour vérifier l'authenticité", {
            x: textX,
            y: masquerDetailsCert ? y - 34 : y - 44,
            size: 6,
            font: this.fonts.regular,
            color: COLORS.grisTexte,
          });
        }
      } catch (e) {
        console.error("QR Error", e);
      }
    }

    return y - boxH - 20;
  }

  drawTable(y: number, colonnes: { label: string, key: string, width: number }[], lignes: DocLigne[], options?: { showClientReception?: boolean }): number {
    this.page.drawRectangle({
      x: MARGINS.x,
      y: y - 20,
      width: CONTENT_W,
      height: 20,
      color: COLORS.bleuFabs,
    });

    let x = MARGINS.x;
    colonnes.forEach(col => {
      const txt = col.label.toUpperCase();
      const txtW = this.fonts.bold.widthOfTextAtSize(txt, 8);
      let headerX = x + (col.width - txtW) / 2;
      if (col.key === 'designation' || col.key === 'code') {
        headerX = x + 5;
      } else if (col.key !== 'num' && col.key !== 'qte' && col.key !== 'remisePct') {
        headerX = x + col.width - txtW - 5;
      }
      
      this.page.drawText(txt, {
        x: headerX,
        y: y - 13,
        size: 8,
        font: this.fonts.bold,
        color: COLORS.blanc,
      });
      x += col.width;
    });

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
      }
      
      const rowH = maxRowH;

      if (i % 2 === 1) {
        this.page.drawRectangle({ 
          x: MARGINS.x, 
          y: curY - rowH, 
          width: CONTENT_W, 
          height: rowH, 
          color: COLORS.orangeZebra
        });
      }

      let curX = MARGINS.x;
      colonnes.forEach(col => {
        const wrapped = wrapResults.get(col.key) || [];
        const lineH = fontSize * 1.2;
        
        wrapped.forEach((lineText, lineIdx) => {
          const txtW = this.fonts.regular.widthOfTextAtSize(lineText, fontSize);
          
          let alignX = curX + colHPadding;
          if (['qte', 'prixUnit', 'remisePct', 'montantHT', 'pu', 'total', 'montant'].includes(col.key)) {
            alignX = curX + col.width - txtW - colHPadding;
          }

          this.page.drawText(lineText, {
            x: alignX,
            y: curY - 14 - lineIdx * lineH,
            size: fontSize,
            font: this.fonts.regular,
            color: COLORS.noir,
          });
        });
        curX += col.width;
      });

      this.page.drawLine({
        start: { x: MARGINS.x, y: curY - rowH },
        end: { x: MARGINS.x + CONTENT_W, y: curY - rowH },
        color: COLORS.grisLigne,
        thickness: 0.5,
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

  drawTotals(y: number): number {
    const isListeProduits = this.data.type === "LISTE DES PRODUITS";
    if (isListeProduits) return y;

    const boxW = 200;
    const x = PAGE.w - MARGINS.x - boxW;
    let curY = y - 10;

    const rows = [
      { label: "SOUS-TOTAL HT", value: this.totals.sousTotal },
    ];

    if (this.totals.remiseLignes && this.totals.remiseLignes > 0) {
      rows.push({ label: "REMISE SUR LIGNES", value: -this.totals.remiseLignes });
    }
    if (this.totals.remiseGlobale && this.totals.remiseGlobale > 0) {
      rows.push({ label: "REMISE GLOBALE", value: -this.totals.remiseGlobale });
    }
    if (this.totals.tva && this.totals.tva > 0) {
      rows.push({ label: "TVA", value: this.totals.tva });
    }
    if (this.totals.frais && this.totals.frais > 0) {
      rows.push({ label: "FRAIS", value: this.totals.frais });
    }

    rows.forEach(row => {
      let labelX = x + 5;
      this.page.drawText(row.label, { x: labelX, y: curY - 13, size: 8, font: this.fonts.regular });
      // Remise globale : afficher le pourcentage en rouge après le libellé
      if (row.label === "REMISE GLOBALE" && this.totals.sousTotal > 0 && this.totals.remiseGlobale) {
        const rawPct = this.totals.remiseGlobalePct ?? (this.totals.remiseGlobale / this.totals.sousTotal) * 100;
        const pct = parseFloat(rawPct.toFixed(10));
        const pctText = `(${pct} %)`;
        labelX += this.fonts.regular.widthOfTextAtSize(row.label, 8) + 4;
        this.page.drawText(pctText, { x: labelX, y: curY - 13, size: 8, font: this.fonts.bold, color: COLORS.rougeFabs });
      }
      const val = formatFCFA(row.value, false);
      const valW = this.fonts.bold.widthOfTextAtSize(val, 9);
      this.page.drawText(val, {
        x: PAGE.w - MARGINS.x - valW - 5,
        y: curY - 13,
        size: 9,
        font: this.fonts.bold,
        color: row.label.toLowerCase().includes('remise') ? COLORS.rougeFabs : COLORS.noir
      });
      curY -= 20;
    });

    this.page.drawRectangle({
      x,
      y: curY - 20,
      width: boxW,
      height: 20,
      color: COLORS.bleuFabs,
    });
    this.page.drawText("TOTAL À PAYER (FCFA)", {
      x: x + 5,
      y: curY - 13,
      size: 9,
      font: this.fonts.bold,
      color: COLORS.blanc,
    });
    const totalVal = formatFCFA(this.totals.totalAPayer, false);
    const totalW = this.fonts.bold.widthOfTextAtSize(totalVal, 10);
    this.page.drawText(totalVal, {
      x: PAGE.w - MARGINS.x - totalW - 5,
      y: curY - 13,
      size: 10,
      font: this.fonts.bold,
      color: COLORS.blanc,
    });

    curY -= 34;

    const fullText = `Arrêté le présent document à la somme de : ${this.totals.montantLettres}`;
    const fontSize = 9.5;
    // Mesure avec la police réellement utilisée (gras) : évite tout débordement
    const wrappedLines = this.wrapText(fullText, CONTENT_W - 4, fontSize, this.fonts.bold);
    
    
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
      color: COLORS.bleuFabs
    });
    curY -= 15;

    const wrapped = this.wrapText(notes, CONTENT_W, 9);
    wrapped.forEach(line => {
      if (curY < MARGINS.bottom + 20) {
        this.addNewPage();
        curY = PAGE.h - 120;
      }
      this.page.drawText(line, { x: MARGINS.x, y: curY, size: 9, font: this.fonts.regular });
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
    
    this.page.drawRectangle({
      x: MARGINS.x,
      y: curY - 60,
      width: boxW,
      height: 60,
      borderColor: COLORS.grisLigne,
      borderWidth: 0.5,
    });
    this.page.drawText("LA COMPTABILITÉ", { x: MARGINS.x + 5, y: curY - 12, size: 8, font: this.fonts.bold });
  }

  async getBytes() {
    return await this.doc.save();
  }

  async getBlob() {
    const bytes = await this.getBytes();
    return new Blob([bytes as any], { type: "application/pdf" });
  }
}
