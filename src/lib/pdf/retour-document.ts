
import { BaseDocument, COLORS, MARGINS, PAGE, CONTENT_W } from "./base-document";

export class RetourDocument extends BaseDocument {
  async drawContent() {
    let y = PAGE.h - 110;
    
    // 1. Facture d'origine
    y = await this.drawHeaderEnrichment(y);
    
    // 2. Infos Client
    y = await this.drawClientSection(y);
    
    // 3. Tableau des articles retournés
    y = this.drawEnrichedTable(y);

    if (this.data.observations) {
      y = this.drawSectionTitle(y, "MOTIFS & OBSERVATIONS");
      y = this.drawLongText(y, this.data.observations, 9);
      y -= 15;
    }
  }

  async drawHeaderEnrichment(y: number): Promise<number> {
    if ((this.data as any).origin) {
      const orig = (this.data as any).origin;
      if (orig.fac) {
        this.page.drawText("FACTURE D'ORIGINE", { x: MARGINS.x, y: y - 10, size: 8, font: this.fonts.bold, color: COLORS.bleuFabs });
        this.page.drawText(`N° : ${orig.fac.ref}`, { x: MARGINS.x, y: y - 27, size: 10, font: this.fonts.bold });
        this.page.drawText(`Date : ${this.formatDate(orig.fac.date)}`, { x: MARGINS.x + 280, y: y - 27, size: 10, font: this.fonts.bold });
        return y - 45;
      }
    }
    return y;
  }

  async drawClientSection(y: number): Promise<number> {
    const entries = [
      { l: "Code client", v: (this.data as any).codeClient },
      { l: "Adresse", v: (this.data as any).adresseClient },
      { l: "Ville", v: (this.data as any).villeClient },
      { l: "Téléphone", v: this.data.clientTel },
      { l: "Email", v: (this.data as any).emailClient },
    ].filter((item) => String(item.v ?? "").trim());
    const boxH = 46 + Math.ceil(entries.length / 2) * 15;
    const boxW = CONTENT_W;
    
    this.page.drawRectangle({
      x: MARGINS.x,
      y: y - boxH,
      width: boxW,
      height: boxH,
      borderColor: COLORS.bleuElectrique, borderWidth: 0.8,
      opacity: 0.5,
    });

    this.page.drawText("IDENTIFICATION CLIENT", { x: MARGINS.x + 10, y: y - 15, size: 7, font: this.fonts.bold, color: COLORS.noir });
    this.page.drawText(String(this.data.clientNom || "CLIENT INCONNU").toUpperCase(), { x: MARGINS.x + 10, y: y - 30, size: 11, font: this.fonts.bold, color: COLORS.noir });
    
    entries.forEach((item, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = MARGINS.x + 10 + col * 270;
      const rowY = y - 48 - row * 15;
      this.page.drawText(`${item.l} :`, { x, y: rowY, size: 8, font: this.fonts.regular });
      const valueX = x + 72;
      const maxW = col === 0 ? 185 : 175;
      const value = String(item.v);
      let size = 8;
      while (this.fonts.bold.widthOfTextAtSize(value, size) > maxW && size > 6) size -= 0.5;
      this.page.drawText(value, { x: valueX, y: rowY, size, font: this.fonts.bold });
    });

    return y - boxH - 15;
  }

  drawEnrichedTable(y: number): number {
    const colonnes = [
      { label: "Code", key: "code", width: 55 },
      { label: "Désignation", key: "designation", width: 172 },
      { label: "Qté fact.", key: "qte_fact", width: 52 },
      { label: "Qté retour", key: "qte_ret", width: 58 },
      { label: "P.U. HT", key: "pu", width: 65 },
      { label: "Remise", key: "remPct", width: 50 },
      { label: "Net HT", key: "net", width: 75 },
    ];

    const lignes = ((this.data as any).lignes || []).map((l: any) => ({
      code: l.codeArticle || "—",
      designation: l.reference || "—",
      qte_fact: l.qteCommandee || 0,
      qte_ret: l.qteRetournee || 0,
      pu: l.prixUnitaire || 0,
      remPct: l.remisePct || 0,
      net: l.montant || 0,
    }));

    return this.drawTable(y, colonnes, lignes);
  }

  formatDate(d: string | null | undefined): string {
    if (!d) return "—";
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    return date.toLocaleDateString("fr-FR");
  }

  drawSectionTitle(y: number, title: string): number {
    this.page.drawText(title, { x: MARGINS.x, y: y - 10, size: 8, font: this.fonts.bold, color: COLORS.noir });
    return y - 22;
  }

  drawLongText(y: number, text: string, size: number): number {
    const lines = this.wrapText(text, CONTENT_W, size);
    lines.forEach(line => {
      this.page.drawText(line, { x: MARGINS.x, y, size, font: this.fonts.regular });
      y -= (size * 1.2);
    });
    return y;
  }
}