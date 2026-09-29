
import { BaseDocument, COLORS, MARGINS, PAGE, CONTENT_W } from "./base-document";
import { formatFCFA } from "@/lib/format";
import { rgb } from "pdf-lib";

export class StatementDocument extends BaseDocument {
  async drawContent(data: any) {
    let y = PAGE.h - 110;
    
    // Infos Client & Période
    y = await this.drawClientInfo(y, data);
    
    // Tableau des opérations
    const colonnes = [
      { label: "Date", key: "date", width: 60 },
      { label: "Référence", key: "reference", width: 90 },
      { label: "Libellé", key: "libelle", width: 150 },
      { label: "Débit", key: "debit", width: 75 },
      { label: "Paiement", key: "credit", width: 75 },
      { label: "Solde", key: "solde", width: 75 },
    ];
    
    const lignes = data.lignes.map((l: any) => ({
      date: /^\d{4}-\d{2}-\d{2}/.test(String(l.date ?? ""))
        ? String(l.date).slice(0, 10).split("-").reverse().join("/")
        : l.date,
      reference: l.reference,
      libelle: l.libelle || l.designation || "",
      debit: l.debit || 0,
      credit: l.credit || 0,
      solde: l.soldeProgressif || 0,
    }));

    y = this.drawTable(y, colonnes, lignes);
    
    // Récapitulatif
    y = this.drawSummary(y, data);
    
    // Signature
    this.drawSignatures(y);
  }

  async drawClientInfo(y: number, data: any): Promise<number> {
    const boxH = 110;
    const boxW = (CONTENT_W - 15) / 2;
    
    // Bloc Client
    this.page.drawRectangle({
      x: MARGINS.x,
      y: y - boxH,
      width: boxW,
      height: boxH,
      color: COLORS.grisClair,
      opacity: 0.5,
    });

    const bleuFabs = COLORS.bleuFabs;
    this.page.drawText("RELEVÉ POUR", { x: MARGINS.x + 10, y: y - 15, size: 7, font: this.fonts.bold, color: bleuFabs });
    this.page.drawText(this.data.client.nom.toUpperCase(), { x: MARGINS.x + 10, y: y - 32, size: 12, font: this.fonts.bold, color: bleuFabs });
    
    const kv = [
      { l: "Ville", v: this.data.client.ville || "—" },
      { l: "Représentant", v: this.data.client.representant || "—" },
      { l: "Téléphone", v: this.data.client.telephone || "—" },
    ];

    kv.forEach((item, i) => {
      const rowY = y - 52 - i * 18;
      this.page.drawText(`${item.l} :`, { x: MARGINS.x + 10, y: rowY, size: 10, font: this.fonts.regular });
      this.page.drawText(String(item.v), { x: MARGINS.x + 105, y: rowY, size: 11, font: this.fonts.bold });
    });


    // Bloc Période
    const perX = MARGINS.x + boxW + 15;
    this.page.drawRectangle({
      x: perX,
      y: y - boxH,
      width: boxW,
      height: boxH,
      color: COLORS.grisClair,
      opacity: 0.5,
    });
    this.page.drawText("PÉRIODE", { x: perX + 10, y: y - 15, size: 7, font: this.fonts.bold, color: COLORS.bleuFabs });
    const periode = data.periodeDebut && data.periodeFin 
      ? `Du ${data.periodeDebut} au ${data.periodeFin}`
      : "Relevé complet";
    this.page.drawText(periode, { x: perX + 10, y: y - 32, size: 9, font: this.fonts.bold });
    
    return y - boxH - 20;
  }

  drawSummary(y: number, data: any): number {
    const boxW = 200;
    const x = PAGE.w - MARGINS.x - boxW;
    let curY = y;

    const row = (label: string, value: number, isTotal = false) => {
      const color = isTotal ? COLORS.rougeFabs : COLORS.noir;
      const font = isTotal ? this.fonts.bold : this.fonts.regular;
      
      this.page.drawText(label, { x: x + 5, y: curY - 13, size: 8, font, color });
      const valText = formatFCFA(value);
      const valW = font.widthOfTextAtSize(valText, 9);
      this.page.drawText(valText, { x: PAGE.w - MARGINS.x - valW - 5, y: curY - 13, size: 9, font, color });
      
      this.page.drawLine({ start: { x, y: curY - 20 }, end: { x: PAGE.w - MARGINS.x, y: curY - 20 }, color: COLORS.grisLigne, thickness: 0.5 });
      curY -= 20;
    };

    const totalDebit = Number(data.totalDebit ?? data.lignes.reduce((a: number, l: any) => a + (l.debit || 0), 0));
    const totalPaiement = Number(data.totalPaiement ?? data.lignes
      .filter((l: any) => l.type === "Paiement")
      .reduce((a: number, l: any) => a + (l.credit || 0), 0));
    const totalRetours = Number(data.totalRetours ?? data.lignes
      .filter((l: any) => l.type === "Avoir")
      .reduce((a: number, l: any) => a + (l.credit || 0), 0));
    const solde = Number(
      data.solde ?? Number(data.soldeOuverture ?? 0) + totalDebit - totalPaiement - totalRetours,
    );

    row("Total Débit", totalDebit);
    row("Total Paiement", totalPaiement);
    if (totalRetours > 0) row("Total Retours", totalRetours);
    row(solde >= 0 ? "SOLDE DÉBITEUR (Impayé)" : "SOLDE CRÉDITEUR", Math.abs(solde), true);

    return curY - 20;
  }

  drawSignatures(y: number) {
    const boxW = 150;
    const curY = Math.max(y - 40, 100);
    this.page.drawRectangle({
      x: PAGE.w - MARGINS.x - boxW,
      y: curY - 60,
      width: boxW,
      height: 60,
      borderColor: COLORS.grisLigne,
      borderWidth: 0.5,
    });
    this.page.drawText("LA COMPTABILITÉ", { x: PAGE.w - MARGINS.x - boxW + 5, y: curY - 12, size: 8, font: this.fonts.bold });
  }
}
