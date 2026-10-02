import { formatDocumentReference } from "@/lib/document-reference";

import { BaseDocument, BODY, roundedRect, COLORS, MARGINS, PAGE, CONTENT_W, CONTENT_BOTTOM } from "./base-document";
import tamponUrl from "@/assets/tampon-comptabilite.png";
import { formatFCFA } from "@/lib/format";
import { numberToLetters } from "./number-to-letters";

export type ReceiptData = {
  paymentNumber: string;
  paymentDate: string;
  customerName: string;
  customerCity?: string;
  customerRep?: string;
  customerPhone?: string;
  invoiceNumber: string;
  invoiceTotal: number;
  balanceBefore: number;
  amountPaid: number;
  balanceAfter: number;
  paymentMethod: string;
  paymentReference?: string;
  notes?: string;
  isReprint?: boolean;
  /** Règlement réparti sur plusieurs factures (affectations réelles du paiement). */
  invoices?: { reference: string; invoiceTotal: number; amountPaid: number }[];
};

export class ReceiptDocument extends BaseDocument {
  receiptData: ReceiptData;

  constructor(docBase: any, receiptData: ReceiptData) {
    // Totals are not used directly in ReceiptDocument (custom layout)
    super(docBase, {} as any);
    this.receiptData = {
      ...receiptData,
      isReprint: new Date(receiptData.paymentDate).toDateString() !== new Date().toDateString() || receiptData.isReprint
    };
  }

  async drawContent() {
    let y = PAGE.h - 110;

    // 1. CLIENT / REÇU DE
    y = await this.drawReceiptClient(y);

    // 2. DÉTAIL DU RÈGLEMENT
    y = this.drawPaymentDetails(y);

    // 3. STATUT & MONTANT EN LETTRES
    y = this.drawStatusAndLetters(y);

    // 4. MESSAGE DE RECONNAISSANCE
    y = this.drawRecognition(y);

    // 5. SIGNATURE
    await this.drawZoneComptabilite(y);
  }

  async drawReceiptClient(y: number): Promise<number> {
    if (this.receiptData.isReprint) {
      this.page.drawText(`Réimprimé le : ${new Date().toLocaleDateString("fr-FR")}`, {
        x: PAGE.w - MARGINS.x - 100,
        y: y + 25,
        size: 7,
        font: this.fonts.italic,
        color: COLORS.grisTexte
      });
    }
    const boxH = 100;
    const qrBoxW = 120;
    const gap = 10;
    const boxW = CONTENT_W - qrBoxW - gap;
    
    roundedRect(this.page, MARGINS.x, y - boxH, CONTENT_W, boxH, 6, {
      color: BODY.grisClair, borderColor: BODY.bord, borderWidth: 0.6,
    });
    const sepX = MARGINS.x + boxW + gap / 2;
    this.page.drawLine({ start: { x: sepX, y: y - 8 }, end: { x: sepX, y: y - boxH + 8 }, color: BODY.bord, thickness: 0.6 });

    this.page.drawText("CLIENT / REÇU DE", { 
      x: MARGINS.x + 10, 
      y: y - 15, 
      size: 7, 
      font: this.fonts.bold, 
      color: BODY.ardoise 
    });

    this.page.drawText(this.receiptData.customerName.toUpperCase(), { 
      x: MARGINS.x + 10, 
      y: y - 35, 
      size: 14, 
      font: this.fonts.bold, 
      color: BODY.nuit 
    });
    
    const kv = [
      { l: "Ville", v: this.receiptData.customerCity ?? "—" },
      { l: "Représentant", v: this.receiptData.customerRep ?? "—" },
      { l: "Téléphone", v: this.receiptData.customerPhone ?? "—" },
    ];

    kv.forEach((item, i) => {
      this.page.drawText(`${item.l} :`, { x: MARGINS.x + 10, y: y - 55 - i * 12, size: 9, font: this.fonts.bold, color: BODY.ardoise });
      this.page.drawText(item.v, { x: MARGINS.x + 85, y: y - 55 - i * 12, size: 9, font: this.fonts.bold, color: BODY.nuit });
    });

    // QR Code en haut à droite, à côté du bloc client
    const qrX = MARGINS.x + boxW + gap;
    await this.drawReceiptQr(qrX, y - boxH, qrBoxW, boxH);

    return y - boxH - 16;
  }

  async drawReceiptQr(x: number, yBottom: number, w: number, h: number) {
    try {
      const { default: QRCode } = await import("qrcode");
      const { QR_COLOR_OPTS, buildQrUrl } = await import("./qr-logic");
      // Même mécanisme que factures / BC / proformas : jeton stable → page /verify.
      const pre = (this.data as any).certification;
      let target: string | null = pre?.verification_url ?? null;
      if (!target) {
        const { ensureVerificationSafe } = await import("@/lib/certification/auto-certify");
        const cert = await ensureVerificationSafe(this.receiptData.paymentNumber);
        target = cert?.verification_url ?? (cert?.token ? buildQrUrl(cert.token) : null);
      }
      if (!target) return; // paiement non validé : pas de QR de vérification
      const url = await QRCode.toDataURL(target, {
        margin: 2, width: 400, errorCorrectionLevel: "M", color: QR_COLOR_OPTS,
      });
      const img = await this.doc.embedPng(url);
      const size = Math.min(w, h) - 20;
      const qx = x + (w - size) / 2, qy = yBottom + (h - size) / 2;
      roundedRect(this.page, qx - 3, qy - 3, size + 6, size + 6, 4, { color: BODY.blanc, borderColor: BODY.bord, borderWidth: 0.6 });
      this.page.drawImage(img, { x: qx, y: qy, width: size, height: size });
    } catch (e) {
      console.error("QR reçu", e);
    }
  }


  /** Factures réellement réglées par ce paiement (≥ 2 = reçu multi-factures). */
  get multiInvoices() {
    const inv = this.receiptData.invoices ?? [];
    return inv.length > 1 ? inv : null;
  }

  drawPaymentDetails(y: number): number {
    const multi = this.multiInvoices;
    const boxH = multi ? 115 + multi.length * 16 : 160;
    const boxW = CONTENT_W;


    this.page.drawText("DÉTAIL DU RÈGLEMENT", { 
      x: MARGINS.x, 
      y: y, 
      size: 10, 
      font: this.fonts.bold, 
      color: BODY.nuit 
    });
    y -= 20;

    roundedRect(this.page, MARGINS.x, y - boxH, boxW, boxH, 6, {
      color: BODY.creme, borderColor: BODY.bord, borderWidth: 0.6,
    });

    let curY = y - 25;

    if (multi) {
      const colImpute = PAGE.w - MARGINS.x - 15;
      const colTotal = colImpute - 120;
      this.page.drawText("Factures réglées", {
        x: MARGINS.x + 15,
        y: curY,
        size: 9,
        font: this.fonts.bold,
        color: COLORS.noir,
      });
      const hTotal = "Montant facture";
      const hImpute = "Imputé";
      this.page.drawText(hTotal, {
        x: colTotal - this.fonts.bold.widthOfTextAtSize(hTotal, 8),
        y: curY,
        size: 8,
        font: this.fonts.bold,
        color: COLORS.noir,
      });
      this.page.drawText(hImpute, {
        x: colImpute - this.fonts.bold.widthOfTextAtSize(hImpute, 8),
        y: curY,
        size: 8,
        font: this.fonts.bold,
        color: COLORS.noir,
      });
      curY -= 14;

      multi.forEach((inv) => {
        this.page.drawText(formatDocumentReference(inv.reference), {
          x: MARGINS.x + 15,
          y: curY,
          size: 9,
          font: this.fonts.regular,
        });
        const tot = formatFCFA(inv.invoiceTotal);
        this.page.drawText(tot, {
          x: colTotal - this.fonts.regular.widthOfTextAtSize(tot, 9),
          y: curY,
          size: 9,
          font: this.fonts.regular,
        });
        const imp = formatFCFA(inv.amountPaid);
        this.page.drawText(imp, {
          x: colImpute - this.fonts.bold.widthOfTextAtSize(imp, 9),
          y: curY,
          size: 9,
          font: this.fonts.bold,
        });
        curY -= 16;
      });
      curY -= 4;
    } else {
      const items = [
        { l: "Facture réglée", v: formatDocumentReference(this.receiptData.invoiceNumber) },
        { l: "Montant facture", v: formatFCFA(this.receiptData.invoiceTotal) },
        { l: "Solde avant paiement", v: formatFCFA(this.receiptData.balanceBefore) },
      ];

      items.forEach(item => {
        this.page.drawText(item.l, { x: MARGINS.x + 15, y: curY, size: 10, font: this.fonts.regular, color: BODY.ardoise });
        const valW = this.fonts.bold.widthOfTextAtSize(item.v, 10);
        this.page.drawText(item.v, { x: PAGE.w - MARGINS.x - valW - 15, y: curY, size: 10, font: this.fonts.bold, color: BODY.nuit });
        curY -= 20;
      });
    }

    // Separator
    this.page.drawLine({
      start: { x: MARGINS.x + 10, y: curY + 5 },
      end: { x: PAGE.w - MARGINS.x - 10, y: curY + 5 },
      color: BODY.filetCreme,
      thickness: 0.6,
    });
    curY -= 10;

    // Montant reçu : bandeau orange plein
    roundedRect(this.page, MARGINS.x + 6, curY - 8, boxW - 12, 26, 4, { color: BODY.orange });
    this.page.drawText("MONTANT REÇU", { 
      x: MARGINS.x + 15, 
      y: curY, 
      size: 12, 
      font: this.fonts.bold, 
      color: BODY.blanc 
    });
    const paidStr = formatFCFA(this.receiptData.amountPaid);
    const paidW = this.fonts.bold.widthOfTextAtSize(paidStr, 15);
    this.page.drawText(paidStr, { 
      x: PAGE.w - MARGINS.x - paidW - 15, 
      y: curY - 1, 
      size: 15, 
      font: this.fonts.bold, 
      color: BODY.blanc 
    });
    curY -= 25;

    // Solde après paiement (mono-facture uniquement : n'a pas de sens en multi-factures)
    if (!multi) {
      this.page.drawText("Solde après paiement", { x: MARGINS.x + 15, y: curY, size: 10, font: this.fonts.regular });
      const balanceAfterStr = formatFCFA(this.receiptData.balanceAfter);
      const balanceAfterW = this.fonts.bold.widthOfTextAtSize(balanceAfterStr, 10);
      this.page.drawText(balanceAfterStr, { x: PAGE.w - MARGINS.x - balanceAfterW - 15, y: curY, size: 10, font: this.fonts.bold });
      curY -= 20;
    }

    // Payment Info
    this.page.drawText(`Mode : ${this.receiptData.paymentMethod}`, { x: MARGINS.x + 15, y: curY, size: 9, font: this.fonts.italic });
    curY -= 12;
    this.page.drawText(`Référence : ${this.receiptData.paymentReference || "—"}`, { x: MARGINS.x + 15, y: curY, size: 9, font: this.fonts.italic });

    return y - boxH - 16;
  }

  drawStatusAndLetters(y: number): number {
    const multi = this.multiInvoices;
    const isSolded = this.receiptData.balanceAfter <= 0;
    const statusText = multi
      ? `RÈGLEMENT RÉPARTI SUR ${multi.length} FACTURES`
      : isSolded
        ? "PAIEMENT COMPLET"
        : "PAIEMENT PARTIEL";
    
    this.page.drawText("STATUT", { x: MARGINS.x, y: y, size: 9, font: this.fonts.bold, color: BODY.nuit });
    y -= 15;
    
    const pillW = this.fonts.bold.widthOfTextAtSize(statusText, 11) + 20;
    roundedRect(this.page, MARGINS.x, y - 6, pillW, 19, 9.5, { color: BODY.peche });
    this.page.drawText(statusText, { 
      x: MARGINS.x + 10, 
      y: y, 
      size: 11, 
      font: this.fonts.bold, 
      color: BODY.orange 
    });
    y -= 25;

    this.page.drawText("En lettres :", { x: MARGINS.x, y: y, size: 9, font: this.fonts.bold, color: BODY.nuit });
    y -= 15;
    
    const letters = numberToLetters(this.receiptData.amountPaid);
    const wrappedLetters = this.wrapText(`${letters}.`, CONTENT_W - 20, 10);
    
    wrappedLetters.forEach(line => {
      this.page.drawText(line, { x: MARGINS.x + 10, y: y, size: 10, font: this.fonts.italic });
      y -= 12;
    });

    return y - 12;
  }

  drawRecognition(y: number): number {
    const multi = this.multiInvoices;
    const isSolded = this.receiptData.balanceAfter <= 0;
    const objet = multi
      ? `du règlement des factures ${multi.map((i) => formatDocumentReference(i.reference)).join(", ")}`
      : `du règlement de la facture ${formatDocumentReference(this.receiptData.invoiceNumber)}`;
    const conclusion = multi
      ? "Ce règlement a été imputé sur chacune des factures listées ci-dessus."
      : isSolded
        ? "Ce règlement solde intégralement la facture."
        : "Ce règlement constitue un paiement partiel de la facture.";
    const lettres = numberToLetters(this.receiptData.amountPaid);
    const somme = lettres.charAt(0).toLowerCase() + lettres.slice(1);
    const recognitionText = `Nous reconnaissons avoir reçu de ${this.receiptData.customerName.toUpperCase()} la somme de ${somme} au titre ${objet}. ${conclusion}`;

    const wrapped = this.wrapText(recognitionText, CONTENT_W, 9);
    wrapped.forEach(line => {
      this.page.drawText(line, { x: MARGINS.x, y: y, size: 9, font: this.fonts.regular });
      y -= 11;
    });

    return y - 10;
  }

  /** Tampon réel (sans titre ni cadre), toujours sur la page 1 au-dessus du pied. */
  async drawZoneComptabilite(y: number) {
    const boxW = 190;
    const x = PAGE.w - MARGINS.x - boxW;
    const top = y - 4;
    const zoneTop = top - 16;
    const zoneH = Math.max(60, Math.min(120, zoneTop - CONTENT_BOTTOM));
    const zoneBottom = zoneTop - zoneH;
    try {
      const res = await fetch(tamponUrl);
      if (!res.ok) return;
      const img = await this.doc.embedPng(new Uint8Array(await res.arrayBuffer()));
      const pad = 6;
      const scale = Math.min((boxW - pad * 2) / img.width, (zoneH - pad * 2) / img.height);
      const w = img.width * scale, h = img.height * scale;
      this.page.drawImage(img, { x: x + (boxW - w) / 2, y: zoneBottom + (zoneH - h) / 2, width: w, height: h });
    } catch {
      // Tampon indisponible : zone réservée conservée, sans erreur.
    }
  }

  // Surcharge Header pour assurer "REÇU DE PAIEMENT"
  drawHeader() {
    super.drawHeader();
    
    const yTop = PAGE.h - 25;
    const sepY = yTop - 70;
    
    // Bandeau orange sous l'en-tête (Spécificité FABS-CI)
    this.page.drawLine({
      start: { x: MARGINS.x, y: sepY },
      end: { x: PAGE.w - MARGINS.x, y: sepY },
      thickness: 1.5,
      color: COLORS.bleuElectrique,
    });
  }
}
