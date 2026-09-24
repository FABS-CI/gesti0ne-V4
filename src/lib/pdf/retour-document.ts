
import { BaseDocument, COLORS, MARGINS, PAGE, CONTENT_W } from "./base-document";
import { formatFCFA } from "@/lib/format";
import { STATUT_RETOUR_LABEL } from "@/lib/retours-api";

export class RetourDocument extends BaseDocument {
  async drawContent() {
    let y = PAGE.h - 110;
    
    // 1. Synthèse Statut & Documents d'Origine
    y = await this.drawHeaderEnrichment(y);
    
    // 2. Infos Client
    y = await this.drawClientSection(y);
    
    // 3. Infos Dépôt & Logistique
    y = await this.drawDepotSection(y);
    
    // 4. Tableau des articles retournés (Version enrichie)
    y = this.drawEnrichedTable(y);
    
    // 5. Synthèses & Observations
    if (y < 250) {
      this.addNewPage();
      y = PAGE.h - 110;
    }
    
    y = this.drawSyntheses(y);

    if (this.data.observations) {
      y = this.drawSectionTitle(y, "MOTIFS & OBSERVATIONS");
      y = this.drawLongText(y, this.data.observations, 9);
      y -= 15;
    }
    
    // 6. Validation multi-niveaux
    this.drawValidationGrid(y);
  }

  async drawHeaderEnrichment(y: number): Promise<number> {
    const label = (STATUT_RETOUR_LABEL[this.data.statut as string] || { label: this.data.statut || "EN ATTENTE", color: "#6B7280" }).label;
    
    // Statut Badge
    const badgeW = 100;
    this.page.drawRectangle({
      x: MARGINS.x,
      y: y - 20,
      width: badgeW,
      height: 18,
      borderColor: COLORS.bleuElectrique,
      borderWidth: 0.5
    });
    this.page.drawText(label.toUpperCase(), {
      x: MARGINS.x + 5,
      y: y - 13,
      size: 8,
      font: this.fonts.bold,
      color: COLORS.noir
    });

    // Documents d'origine
    if ((this.data as any).origin) {
      const orig = (this.data as any).origin;
      const texts: string[] = [];
      if (orig.cmd) texts.push(`CMD: ${orig.cmd.ref} (${this.formatDate(orig.cmd.date)})`);
      if (orig.fac) texts.push(`FAC: ${orig.fac.ref} (${this.formatDate(orig.fac.date)})`);
      if (orig.bl) texts.push(`BL: ${orig.bl.ref} (${this.formatDate(orig.bl.date)})`);
      
      if (texts.length > 0) {
        this.page.drawText("DOCUMENTS D'ORIGINE : " + texts.join(" | "), {
          x: MARGINS.x + badgeW + 20,
          y: y - 13,
          size: 8,
          font: this.fonts.italic,
          color: COLORS.grisTexte
        });
      }
    }

    return y - 35;
  }

  async drawClientSection(y: number): Promise<number> {
    const boxH = 95;
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
    
    const leftCol: any[] = [
      { l: "Code Client", v: (this.data as any).codeClient || "—" },
      { l: "Adresse", v: (this.data as any).adresseClient || "—" },
      { l: "Ville", v: (this.data as any).villeClient || "—" },
      { l: "NCC/NIF", v: (this.data as any).ncc || "—" },
    ];
    const rightCol: any[] = [
      { l: "Représentant", v: this.data.representant || "—" },
      { l: "Tél. Principal", v: this.data.clientTel || "—" },
      { l: "Tél. Secondaire", v: (this.data as any).representantTel || "—" },
      { l: "Email", v: (this.data as any).emailClient || "—" },
    ];

    leftCol.forEach((item, i) => {
      this.page.drawText(`${item.l} :`, { x: MARGINS.x + 10, y: y - 45 - i * 11, size: 8, font: this.fonts.regular });
      this.page.drawText(String(item.v), { x: MARGINS.x + 80, y: y - 45 - i * 11, size: 8, font: this.fonts.bold });
    });

    rightCol.forEach((item, i) => {
      this.page.drawText(`${item.l} :`, { x: MARGINS.x + 280, y: y - 45 - i * 11, size: 8, font: this.fonts.regular });
      this.page.drawText(String(item.v), { x: MARGINS.x + 360, y: y - 45 - i * 11, size: 8, font: this.fonts.bold });
    });

    return y - boxH - 15;
  }

  async drawDepotSection(y: number): Promise<number> {
    const depot = (this.data as any).depot;
    if (!depot) return y;

    const boxH = 65;
    this.page.drawRectangle({
      x: MARGINS.x,
      y: y - boxH,
      width: CONTENT_W,
      height: boxH,
      borderColor: COLORS.bleuElectrique,
      borderWidth: 0.5,
      opacity: 0.1
    });

    this.page.drawText("DÉPÔT DE RÉCEPTION", { x: MARGINS.x + 10, y: y - 15, size: 7, font: this.fonts.bold, color: COLORS.noir });
    
    const info = [
      { l: "Dépôt", v: `${depot.nom} (${depot.code})` },
      { l: "Responsable", v: depot.responsable || "—" },
      { l: "Téléphone", v: depot.telephone || "—" },
      { l: "Localisation", v: `${depot.adresse || ""} ${depot.ville || ""}`.trim() || "—" }
    ];

    info.forEach((item, i) => {
      const xPos = MARGINS.x + 10 + (i % 2) * 250;
      const yPos = y - 30 - Math.floor(i / 2) * 12;
      this.page.drawText(`${item.l} :`, { x: xPos, y: yPos, size: 8, font: this.fonts.regular });
      this.page.drawText(item.v, { x: xPos + 70, y: yPos, size: 8, font: this.fonts.bold });
    });

    return y - boxH - 15;
  }

  drawEnrichedTable(y: number): number {
    const colonnes = [
      { label: "Code", key: "code", width: 55 },
      { label: "Désignation", key: "designation", width: 140 },
      { label: "Qté Dem.", key: "qte_dem", width: 45 },
      { label: "Qté Rec.", key: "qte_rec", width: 45 },
      { label: "P.U. HT", key: "pu", width: 55 },
      { label: "Rem %", key: "remPct", width: 35 },
      { label: "Net HT", key: "net", width: 65 },
      { label: "Dépôt / État", key: "info", width: 87 },
    ];

    const lignes = ((this.data as any).lignes || []).map((l: any) => ({
      code: l.codeArticle || "—",
      designation: l.reference || "—",
      qte_dem: l.qteDemandee || 0,
      qte_rec: l.qteRetournee || 0,
      pu: l.prixUnitaire || 0,
      remPct: l.remisePct || 0,
      net: l.montant || 0,
      info: `${l.motif || "N/R"}\n[${String(l.etat_produit || "À contrôler").toUpperCase()}]`
    }));

    return this.drawTable(y, colonnes, lignes);
  }

  drawSyntheses(y: number): number {
    const boxW = (CONTENT_W - 15) / 2;
    const boxH = 85;

    // 1. Synthèse Stock
    this.page.drawRectangle({ x: MARGINS.x, y: y - boxH, width: boxW, height: boxH, borderColor: COLORS.bleuElectrique, borderWidth: 0.5 });
    this.page.drawText("SYNTHÈSE STOCK", { x: MARGINS.x + 5, y: y - 12, size: 8, font: this.fonts.bold, color: COLORS.noir });
    
    const stockItems = [
      { l: "Unités demandées", v: (this.data as any).totalQteDem || this.data.lignes?.reduce((a, b) => a + (b as any).qteDemandee, 0) || 0 },
      { l: "Unités reçues", v: (this.data as any).totalQteRec || this.data.lignes?.reduce((a, b) => a + (b as any).qteRetournee, 0) || 0 },
      { l: "Unités acceptées", v: (this.data as any).totalQteRec || 0 }, // Simplifié pour FABS V10
      { l: "Unités refusées", v: 0 },
    ];
    stockItems.forEach((item, i) => {
      this.page.drawText(item.l, { x: MARGINS.x + 5, y: y - 28 - i * 12, size: 8, font: this.fonts.regular });
      this.page.drawText(String(item.v), { x: MARGINS.x + boxW - 30, y: y - 28 - i * 12, size: 8, font: this.fonts.bold });
    });

    // 2. Synthèse Financière
    const finX = MARGINS.x + boxW + 15;
    this.page.drawRectangle({ x: finX, y: y - boxH, width: boxW, height: boxH, color: COLORS.noir, opacity: 0.05 });
    this.page.drawText("SYNTHÈSE FINANCIÈRE (FCFA)", { x: finX + 5, y: y - 12, size: 8, font: this.fonts.bold, color: COLORS.noir });
    
    const finItems = [
      { l: "Total Brut HT", v: (this.data as any).totalVente || 0 },
      { l: "Total Remises", v: (this.data as any).remiseLigneTotal || 0 },
      { l: "TOTAL NET HT", v: (this.data as any).montantHT || 0, isBold: true },
      { l: "TOTAL TTC", v: (this.data as any).totalTTC || 0, isBold: true },
    ];
    finItems.forEach((item, i) => {
      this.page.drawText(item.l, { x: finX + 5, y: y - 28 - i * 12, size: 8, font: item.isBold ? this.fonts.bold : this.fonts.regular });
      const val = formatFCFA(item.v, false);
      const valW = this.fonts.bold.widthOfTextAtSize(val, 8);
      this.page.drawText(val, { x: finX + boxW - valW - 5, y: y - 28 - i * 12, size: 8, font: this.fonts.bold });
    });

    return y - boxH - 20;
  }

  drawValidationGrid(y: number) {
    const boxW = (CONTENT_W - 20) / 3;
    const boxH = 80;
    const curY = Math.max(y - 30, 140);
    
    const steps = [
      { l: "CRÉÉ / DEMANDÉ PAR", v: this.data.demandeurNom || "—", date: this.data.date },
      { l: "RÉCEPTIONNÉ (MAGASIN)", v: (this.data as any).receptionne_par_nom || "—", date: (this.data as any).receptionne_at },
      { l: "APPROUVÉ (COMPTA)", v: this.data.valide_compta_par_nom || "—", date: this.data.valide_compta_at },
    ];

    steps.forEach((s, i) => {
      const x = MARGINS.x + i * (boxW + 10);
      this.page.drawRectangle({ x, y: curY - boxH, width: boxW, height: boxH, borderColor: COLORS.bleuElectrique, borderWidth: 0.5 });
      this.page.drawText(s.l, { x: x + 5, y: curY - 12, size: 7, font: this.fonts.bold, color: COLORS.noir });
      this.page.drawText(s.v, { x: x + 5, y: curY - 25, size: 8, font: this.fonts.regular });
      if (s.date) {
        this.page.drawText(`Le ${this.formatDate(s.date)}`, { x: x + 5, y: curY - 35, size: 7, font: this.fonts.italic, color: COLORS.grisTexte });
      }
      this.page.drawText("Signature :", { x: x + 5, y: curY - 70, size: 6, font: this.fonts.regular });
    });
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