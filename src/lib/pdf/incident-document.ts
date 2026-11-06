import { BaseDocument, COLORS, MARGINS, PAGE, CONTENT_W, type DocBase } from "./base-document";
import { formatFCFA } from "@/lib/format";

function fmtDate(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("fr-FR");
}

export type IncidentDocPayload = {
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
  lignes: Array<{
    numero: number;
    reference: string;
    designation: string;
    quantite: number;
    unite: string;
    valeurUnitaire: number;
    valeurTotale: number;
    observation: string;
  }>;
};

/** Fiche d'incident de stock — moteur pdf-lib unifié (charte FABS-CI). */
export class IncidentDocument extends BaseDocument {
  payload: IncidentDocPayload;

  constructor(base: DocBase, payload: IncidentDocPayload) {
    super(base, {} as never);
    this.payload = payload;
  }

  async drawContent() {
    let y = PAGE.h - 110;
    y = this.drawInfoGrid(y);
    y = this.drawLignes(y);
    y = this.drawTotal(y);
    y = this.drawTexte(y, "MOTIF", this.payload.motif);
    y = this.drawTexte(y, "OBSERVATIONS", this.payload.observations);
    this.drawSignatures(y);
  }

  private drawInfoGrid(y: number): number {
    const p = this.payload;
    const rows: Array<[string, string]> = [
      ["N° incident", p.numero || "—"],
      ["Date / heure", `${fmtDate(p.dateIncident)}${p.heureIncident ? ` à ${p.heureIncident}` : ""}`],
      ["Type", p.typeIncident || "—"],
      ["Statut", p.statut?.label ?? "—"],
      ["Gravité", p.gravite ?? "—"],
      ["Dépôt / magasin", [p.depot, p.magasin].filter(Boolean).join(" / ") || "—"],
      ["Responsable", p.responsable ?? "—"],
      ["Déclarant", `${p.declarant ?? "—"} (${fmtDate(p.dateDeclaration)})`],
    ];

    const boxH = 20 + Math.ceil(rows.length / 2) * 14 + 8;
    this.page.drawRectangle({
      x: MARGINS.x,
      y: y - boxH,
      width: CONTENT_W,
      height: boxH,
      color: COLORS.grisClair,
      opacity: 0.6,
    });
    this.page.drawText("INFORMATIONS INCIDENT", {
      x: MARGINS.x + 10,
      y: y - 14,
      size: 8,
      font: this.fonts.bold,
      color: COLORS.bleuFabs,
    });

    const colW = CONTENT_W / 2;
    rows.forEach(([label, value], i) => {
      const col = i % 2;
      const line = Math.floor(i / 2);
      const x = MARGINS.x + 10 + col * colW;
      const ly = y - 30 - line * 14;
      this.page.drawText(`${label} :`, { x, y: ly, size: 8, font: this.fonts.regular, color: COLORS.grisTexte });
      this.page.drawText(value, { x: x + 95, y: ly, size: 8, font: this.fonts.bold, color: COLORS.noir });
    });

    return y - boxH - 20;
  }

  private drawLignes(y: number): number {
    const colonnes = [
      { label: "N°", key: "num", width: 24 },
      { label: "Référence", key: "code", width: 80 },
      { label: "Désignation", key: "designation", width: CONTENT_W - 24 - 80 - 40 - 80 - 90 },
      { label: "Qté", key: "qte", width: 40 },
      { label: "Valeur unit.", key: "pu", width: 80 },
      { label: "Valeur totale", key: "total", width: 90 },
    ];
    const lignes = this.payload.lignes.map((l, i) => ({
      num: l.numero || i + 1,
      code: l.reference || "—",
      designation: l.designation || "—",
      qte: l.quantite,
      pu: l.valeurUnitaire,
      total: l.valeurTotale,
    }));
    return this.drawTable(y, colonnes, lignes as never);
  }

  private drawTotal(y: number): number {
    const total = this.payload.lignes.reduce((s, l) => s + (l.valeurTotale || 0), 0);
    const qte = this.payload.lignes.reduce((s, l) => s + (l.quantite || 0), 0);
    let curY = y - 10;
    if (curY < MARGINS.bottom + 60) {
      this.addNewPage();
      curY = PAGE.h - 120;
    }
    const boxW = 240;
    const x = PAGE.w - MARGINS.x - boxW;
    this.page.drawRectangle({
      x,
      y: curY - 34,
      width: boxW,
      height: 34,
      color: COLORS.grisClair,
      borderColor: COLORS.bleuFabs,
      borderWidth: 0.5,
    });
    this.page.drawText(`Quantité totale : ${qte}`, {
      x: x + 8, y: curY - 13, size: 8, font: this.fonts.regular,
    });
    this.page.drawText("VALEUR ESTIMÉE", {
      x: x + 8, y: curY - 26, size: 9, font: this.fonts.bold, color: COLORS.bleuFabs,
    });
    const val = formatFCFA(total);
    const valW = this.fonts.bold.widthOfTextAtSize(val, 10);
    this.page.drawText(val, {
      x: PAGE.w - MARGINS.x - valW - 8, y: curY - 26, size: 10, font: this.fonts.bold, color: COLORS.rougeFabs,
    });
    return curY - 44;
  }

  private drawTexte(y: number, titre: string, texte: string | null): number {
    if (!texte) return y;
    let curY = y - 6;
    if (curY < MARGINS.bottom + 50) {
      this.addNewPage();
      curY = PAGE.h - 120;
    }
    this.page.drawText(`${titre} :`, { x: MARGINS.x, y: curY, size: 8, font: this.fonts.bold, color: COLORS.bleuFabs });
    curY -= 14;
    this.wrapText(texte, CONTENT_W, 9).forEach((line) => {
      if (curY < MARGINS.bottom + 20) {
        this.addNewPage();
        curY = PAGE.h - 120;
      }
      this.page.drawText(line, { x: MARGINS.x, y: curY, size: 9, font: this.fonts.regular });
      curY -= 12;
    });
    return curY - 8;
  }

  drawSignatures(y: number) {
    const boxW = (CONTENT_W - 20) / 2;
    const boxH = 60;
    let curY = y - 20;
    if (curY - boxH < MARGINS.bottom + 20) {
      this.addNewPage();
      curY = PAGE.h - 160;
    }
    [
      { x: MARGINS.x, label: "LE DÉCLARANT" },
      { x: PAGE.w - MARGINS.x - boxW, label: "LE RESPONSABLE STOCK" },
    ].forEach((b) => {
      this.page.drawRectangle({
        x: b.x, y: curY - boxH, width: boxW, height: boxH,
        borderColor: COLORS.grisLigne, borderWidth: 0.5,
      });
      this.page.drawText(b.label, { x: b.x + 5, y: curY - 14, size: 8, font: this.fonts.bold });
      this.page.drawText("Nom : ....................................", { x: b.x + 5, y: curY - 30, size: 7, font: this.fonts.regular });
      this.page.drawText("Signature :", { x: b.x + 5, y: curY - 50, size: 7, font: this.fonts.italic });
    });
  }
}

export type RapportIncidentsPayload = {
  reference: string;
  periodeLabel: string;
  filtresLabel: string | null;
  lignes: Array<{
    numero: string;
    date: string;
    type: string;
    magasin: string | null;
    nbProduits: number;
    quantite: number;
    valeur: number;
    statut: string;
  }>;
};

/** Rapport (liste) des incidents — même charte. */
export class RapportIncidentsDocument extends BaseDocument {
  payload: RapportIncidentsPayload;

  constructor(base: DocBase, payload: RapportIncidentsPayload) {
    super(base, {} as never);
    this.payload = payload;
  }

  async drawContent() {
    let y = PAGE.h - 110;
    const p = this.payload;

    this.page.drawText(`Période : ${p.periodeLabel}`, {
      x: MARGINS.x, y, size: 9, font: this.fonts.bold, color: COLORS.bleuFabs,
    });
    y -= 14;
    if (p.filtresLabel) {
      this.page.drawText(`Filtres : ${p.filtresLabel}`, { x: MARGINS.x, y, size: 8, font: this.fonts.regular });
      y -= 14;
    }
    this.page.drawText(`${p.lignes.length} incident(s)`, { x: MARGINS.x, y, size: 8, font: this.fonts.regular });
    y -= 20;

    const colonnes = [
      { label: "N°", key: "code", width: 85 },
      { label: "Date", key: "designation", width: 60 },
      { label: "Type", key: "type", width: 90 },
      { label: "Magasin", key: "magasin", width: 90 },
      { label: "Produits", key: "num", width: 45 },
      { label: "Qté", key: "qte", width: 40 },
      { label: "Valeur", key: "total", width: CONTENT_W - 85 - 60 - 90 - 90 - 45 - 40 - 60 },
      { label: "Statut", key: "statut", width: 60 },
    ];

    const lignes = p.lignes.map((l) => ({
      code: l.numero,
      designation: fmtDate(l.date),
      type: l.type,
      magasin: l.magasin ?? "—",
      num: l.nbProduits,
      qte: l.quantite,
      total: l.valeur,
      statut: l.statut,
    }));

    y = this.drawTable(y, colonnes, lignes as never);

    const totalValeur = p.lignes.reduce((s, l) => s + (l.valeur || 0), 0);
    const totalQte = p.lignes.reduce((s, l) => s + (l.quantite || 0), 0);
    let curY = y - 12;
    if (curY < MARGINS.bottom + 40) {
      this.addNewPage();
      curY = PAGE.h - 120;
    }
    const txt = `TOTAL — ${totalQte} article(s) · ${formatFCFA(totalValeur)}`;
    const w = this.fonts.bold.widthOfTextAtSize(txt, 10);
    this.page.drawText(txt, {
      x: PAGE.w - MARGINS.x - w, y: curY, size: 10, font: this.fonts.bold, color: COLORS.bleuFabs,
    });
  }
}
