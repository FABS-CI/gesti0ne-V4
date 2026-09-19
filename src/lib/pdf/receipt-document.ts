
import { BaseDocument, COLORS, MARGINS, PAGE, CONTENT_W } from "./base-document";
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
    y = this.drawReceiptClient(y);

    // 2. DÉTAIL DU RÈGLEMENT
    y = this.drawPaymentDetails(y);

    // 3. STATUT & MONTANT EN LETTRES
    y = this.drawStatusAndLetters(y);

    // 4. MESSAGE DE RECONNAISSANCE
    y = this.drawRecognition(y);

    // 5. SIGNATURE
    this.drawSignatures(y);
  }

  drawReceiptClient(y: number): number {
    if (this.receiptData.isReprint) {
      this.page.drawText(`Réimprimé le : ${new Date().toLocaleDateString("fr-FR")}`, {
        x: PAGE.w - MARGINS.x - 100,
        y: y + 25,
        size: 7,
        font: this.fonts.italic,
        color: COLORS.grisTexte
      });
    }
    const boxH = 90;
    const boxW = CONTENT_W;
    
    this.page.drawRectangle({
      x: MARGINS.x,
      y: y - boxH,
      width: boxW,
      height: boxH,
      color: COLORS.grisClair,
      opacity: 0.5,
    });

    this.page.drawText("CLIENT / REÇU DE", { 
      x: MARGINS.x + 10, 
      y: y - 15, 
      size: 7, 
      font: this.fonts.bold, 
      color: COLORS.bleuFabs 
    });

    this.page.drawText(this.receiptData.customerName.toUpperCase(), { 
      x: MARGINS.x + 10, 
      y: y - 35, 
      size: 14, 
      font: this.fonts.bold, 
      color: COLORS.bleuFabs 
    });
    
    const kv = [
      { l: "Ville", v: this.receiptData.customerCity ?? "—" },
      { l: "Représentant", v: this.receiptData.customerRep ?? "—" },
      { l: "Téléphone", v: this.receiptData.customerPhone ?? "—" },
    ];

    kv.forEach((item, i) => {
      this.page.drawText(`${item.l} :`, { x: MARGINS.x + 10, y: y - 55 - i * 12, size: 9, font: this.fonts.regular });
      this.page.drawText(item.v, { x: MARGINS.x + 85, y: y - 55 - i * 12, size: 9, font: this.fonts.bold });
    });

    return y - boxH - 20;
  }

  drawPaymentDetails(y: number): number {
    const boxH = 160;
    const boxW = CONTENT_W;

    this.page.drawText("DÉTAIL DU RÈGLEMENT", { 
      x: MARGINS.x, 
      y: y, 
      size: 10, 
      font: this.fonts.bold, 
      color: COLORS.bleuFabs 
    });
    y -= 20;

    this.page.drawRectangle({
      x: MARGINS.x,
      y: y - boxH,
      width: boxW,
      height: boxH,
      borderColor: COLORS.grisLigne,
      borderWidth: 0.5,
    });

    let curY = y - 25;
    const items = [
      { l: "Facture réglée", v: this.receiptData.invoiceNumber },
      { l: "Montant facture", v: formatFCFA(this.receiptData.invoiceTotal) },
      { l: "Solde avant paiement", v: formatFCFA(this.receiptData.balanceBefore) },
    ];

    items.forEach(item => {
      this.page.drawText(item.l, { x: MARGINS.x + 15, y: curY, size: 10, font: this.fonts.regular });
      const valW = this.fonts.bold.widthOfTextAtSize(item.v, 10);
      this.page.drawText(item.v, { x: PAGE.w - MARGINS.x - valW - 15, y: curY, size: 10, font: this.fonts.bold });
      curY -= 20;
    });

    // Separator
    this.page.drawLine({
      start: { x: MARGINS.x + 10, y: curY + 5 },
      end: { x: PAGE.w - MARGINS.x - 10, y: curY + 5 },
      color: COLORS.orangeFabs,
      thickness: 1,
    });
    curY -= 10;

    // Amount Paid (HIGHLIGHT)
    this.page.drawText("MONTANT REÇU", { 
      x: MARGINS.x + 15, 
      y: curY, 
      size: 12, 
      font: this.fonts.bold, 
      color: COLORS.bleuFabs 
    });
    const paidStr = formatFCFA(this.receiptData.amountPaid);
    const paidW = this.fonts.bold.widthOfTextAtSize(paidStr, 14);
    this.page.drawText(paidStr, { 
      x: PAGE.w - MARGINS.x - paidW - 15, 
      y: curY, 
      size: 14, 
      font: this.fonts.bold, 
      color: COLORS.bleuFabs 
    });
    curY -= 25;

    // Balance After
    this.page.drawText("Solde après paiement", { x: MARGINS.x + 15, y: curY, size: 10, font: this.fonts.regular });
    const balanceAfterStr = formatFCFA(this.receiptData.balanceAfter);
    const balanceAfterW = this.fonts.bold.widthOfTextAtSize(balanceAfterStr, 10);
    this.page.drawText(balanceAfterStr, { x: PAGE.w - MARGINS.x - balanceAfterW - 15, y: curY, size: 10, font: this.fonts.bold });
    curY -= 20;

    // Payment Info
    this.page.drawText(`Mode : ${this.receiptData.paymentMethod}`, { x: MARGINS.x + 15, y: curY, size: 9, font: this.fonts.italic });
    curY -= 12;
    this.page.drawText(`Référence : ${this.receiptData.paymentReference || "—"}`, { x: MARGINS.x + 15, y: curY, size: 9, font: this.fonts.italic });

    return y - boxH - 25;
  }

  drawStatusAndLetters(y: number): number {
    const isSolded = this.receiptData.balanceAfter <= 0;
    const statusText = isSolded ? "PAIEMENT COMPLET" : "PAIEMENT PARTIEL";
    
    this.page.drawText("STATUT", { x: MARGINS.x, y: y, size: 9, font: this.fonts.bold, color: COLORS.bleuFabs });
    y -= 15;
    
    this.page.drawText(statusText, { 
      x: MARGINS.x + 10, 
      y: y, 
      size: 11, 
      font: this.fonts.bold, 
      color: isSolded ? COLORS.bleuFabs : COLORS.orangeFabs 
    });
    y -= 25;

    this.page.drawText("En lettres :", { x: MARGINS.x, y: y, size: 9, font: this.fonts.bold });
    y -= 15;
    
    const letters = numberToLetters(this.receiptData.amountPaid);
    const wrappedLetters = this.wrapText(`${letters} francs CFA.`, CONTENT_W - 20, 10);
    
    wrappedLetters.forEach(line => {
      this.page.drawText(line, { x: MARGINS.x + 10, y: y, size: 10, font: this.fonts.italic });
      y -= 12;
    });

    return y - 20;
  }

  drawRecognition(y: number): number {
    const isSolded = this.receiptData.balanceAfter <= 0;
    const recognitionText = `Nous reconnaissons avoir reçu de ${this.receiptData.customerName.toUpperCase()} la somme de ${numberToLetters(this.receiptData.amountPaid)} francs CFA au titre du règlement de la facture ${this.receiptData.invoiceNumber}. ${isSolded ? "Ce règlement solde intégralement la facture." : "Ce règlement constitue un paiement partiel de la facture."}`;

    const wrapped = this.wrapText(recognitionText, CONTENT_W, 9);
    wrapped.forEach(line => {
      this.page.drawText(line, { x: MARGINS.x, y: y, size: 9, font: this.fonts.regular });
      y -= 11;
    });

    return y - 20;
  }

  // Surcharge BaseDocument wrapText logic if needed, but it's inherited.
  // Note: drawSignatures is already in BaseDocument
  drawSignatures(y: number) {
    const boxW = 180;
    const boxH = 70;
    const curY = Math.max(y - 80, 150);
    
    this.page.drawRectangle({
      x: PAGE.w - MARGINS.x - boxW,
      y: curY - boxH,
      width: boxW,
      height: boxH,
      borderColor: COLORS.grisLigne,
      borderWidth: 0.5,
    });
    this.page.drawText("LA COMPTABILITÉ", { x: PAGE.w - MARGINS.x - boxW + 5, y: curY - 15, size: 9, font: this.fonts.bold });
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
      color: COLORS.orangeFabs,
    });
  }
}
