import type { ProduitLigneRapport } from "@/lib/rapports-api";
import { formatFCFA, formatDate } from "@/lib/format";
import { getActiveTemplate } from "@/lib/pdf/pdfConfig";
import { drawHeader, ensurePdfLogo, getPdfChromeBodyTop } from "@/lib/pdf/pdfChrome";

export type RapportProduitsMeta = {
  /** Libellé de période, ex. « 01/01/2026 → 31/03/2026 » */
  periode?: string;
  /** Filtres actifs affichés en en-tête (label: valeur) */
  filtres?: Array<{ label: string; value: string }>;
};

const COLUMNS: Array<{
  header: string;
  width: number;
  align: "left" | "right" | "center";
}> = [
  { header: "Code", width: 21, align: "left" },
  { header: "Désignation", width: 54, align: "left" },
  { header: "PU", width: 18, align: "right" },
  { header: "Qté vend.", width: 18, align: "right" },
  { header: "Clients", width: 14, align: "right" },
  { header: "CA (net de remises)", width: 28, align: "right" },
  { header: "Stock act.", width: 17, align: "right" },
  { header: "Stock init.", width: 17, align: "right" },
];

const MARGIN_X = 10;
const FOOTER_H = 16;

/** jsPDF (helvetica) est limité au Latin-1 : on remplace les caractères hors jeu. */
function safe(v: string): string {
  return v.replace(/[\u2192\u2013\u2014]/g, "-").replace(/[\u2022]/g, "-").replace(/\u00a0/g, " ");
}

function num(v: number | null | undefined): string {
  if (v == null || isNaN(Number(v))) return "0";
  return Math.round(Number(v))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function money(v: number | null | undefined): string {
  return formatFCFA(v ?? 0, false);
}

export function rowCells(r: ProduitLigneRapport): string[] {
  return [
    r.code ?? "-",
    r.titre ?? "-",
    money(r.prix_unitaire),
    num(r.qte_vendue),
    num(r.nb_clients),
    money(r.ca),
    num(r.stock_actuel),
    num(r.stock_initial),
  ];
}

/** Totaux du récapitulatif : produits, quantité, CA, prix d'achat, stock restant. */
export function rapportProduitsTotaux(rows: ProduitLigneRapport[]) {
  return rows.reduce(
    (acc, r) => {
      acc.qte += Number(r.qte_vendue ?? 0);
      acc.ca += Number(r.ca ?? 0);
      acc.achat += Number(r.cout_achat ?? Number(r.qte_vendue ?? 0) * Number(r.prix_achat ?? 0));
      acc.stock += Number(r.stock_actuel ?? 0);
      return acc;
    },
    { produits: rows.length, qte: 0, ca: 0, achat: 0, stock: 0 },
  );
}

/**
 * Rapport produits — PDF A4 portrait dédié.
 * En-tête compact (date d'édition, période, filtres), 8 colonnes à largeurs
 * calibrées, en-têtes répétés à chaque page, pagination « Page X / Y »,
 * récapitulatif final et pied de page simplifié (sans coordonnées bancaires).
 */
export async function exportRapportProduitsPdf(
  rows: ProduitLigneRapport[],
  meta: RapportProduitsMeta = {},
): Promise<void> {
  const [{ default: jsPDF }] = await Promise.all([import("jspdf")]);
  await ensurePdfLogo();
  const t = getActiveTemplate();

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const tableW = COLUMNS.reduce((s, c) => s + c.width, 0);
  const scale = (pageW - MARGIN_X * 2) / tableW;
  const widths = COLUMNS.map((c) => c.width * scale);

  const HEAD_H = 10;
  const LINE_H = 4.2;
  const PAD = 1.6;
  const bottomLimit = pageH - FOOTER_H - 6;

  const drawTableHead = (y: number): number => {
    doc.setFillColor(204, 78, 0);
    doc.rect(MARGIN_X, y, pageW - MARGIN_X * 2, HEAD_H, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(255, 255, 255);
    let x = MARGIN_X;
    COLUMNS.forEach((c, i) => {
      const w = widths[i];
      const lines = doc.splitTextToSize(safe(c.header), w - PAD * 2) as string[];
      const startY = y + HEAD_H / 2 - ((lines.length - 1) * 2.6) / 2 + 1;
      lines.forEach((ln, li) => {
        const ty = startY + li * 2.6;
        if (c.align === "right") doc.text(ln, x + w - PAD, ty, { align: "right" });
        else if (c.align === "center") doc.text(ln, x + w / 2, ty, { align: "center" });
        else doc.text(ln, x + PAD, ty);
      });
      x += w;
    });
    return y + HEAD_H;
  };

  const drawMetaBlock = (y: number): number => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(204, 78, 0);
    doc.text("RAPPORT PRODUITS", pageW / 2, y, { align: "center" });
    const now = new Date();
    const infos: string[] = [`Édité le : ${formatDate(now)}`];
    if (meta.periode) infos.push(`Période : ${meta.periode}`);
    for (const f of meta.filtres ?? []) {
      if (f.value) infos.push(`${f.label} : ${f.value}`);
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(70, 70, 70);
    const lines = doc.splitTextToSize(safe(infos.join("   -   ")), pageW - MARGIN_X * 2) as string[];
    lines.forEach((ln, i) => doc.text(ln, pageW / 2, y + 5 + i * 3.8, { align: "center" }));
    return y + 7 + lines.length * 3.8;
  };

  // Première page
  drawHeader(doc, "", t);
  let y = drawMetaBlock(getPdfChromeBodyTop());
  y = drawTableHead(y);

  doc.setFont("helvetica", "normal");
  let alt = false;
  for (const r of rows) {
    const cells = rowCells(r).map(safe);
    const wrapped = cells.map((v, i) =>
      COLUMNS[i].align === "left" ? (doc.splitTextToSize(v, widths[i] - PAD * 2) as string[]) : [v],
    );
    const nLines = Math.max(...wrapped.map((w) => w.length));
    const rowH = Math.max(6, nLines * LINE_H + 2);

    if (y + rowH > bottomLimit) {
      doc.addPage();
      y = drawTableHead(getPdfChromeBodyTop() - 18);
      doc.setFont("helvetica", "normal");
    }

    if (alt) {
      doc.setFillColor(247, 247, 247);
      doc.rect(MARGIN_X, y, pageW - MARGIN_X * 2, rowH, "F");
    }
    alt = !alt;
    doc.setDrawColor(225, 225, 225);
    doc.setLineWidth(0.1);
    doc.line(MARGIN_X, y + rowH, pageW - MARGIN_X, y + rowH);

    doc.setFontSize(7.5);
    doc.setTextColor(20, 20, 20);
    let x = MARGIN_X;
    COLUMNS.forEach((c, i) => {
      const w = widths[i];
      const fit = c.align !== "left" && doc.getTextWidth(wrapped[i][0]) > w - PAD * 2;
      doc.setFontSize(fit ? 6.2 : 7.5);
      wrapped[i].forEach((ln, li) => {
        const ty = y + 4 + li * LINE_H;
        if (c.align === "right") doc.text(ln, x + w - PAD, ty, { align: "right" });
        else if (c.align === "center") doc.text(ln, x + w / 2, ty, { align: "center" });
        else doc.text(ln, x + PAD, ty);
      });
      x += w;
    });
    y += rowH;
  }

  // Récapitulatif
  const totals = rapportProduitsTotaux(rows);
  const summary: Array<[string, string]> = [
    ["Nombre de produits", String(totals.produits)],
    ["Quantité vendue", num(totals.qte)],
    ["Chiffre d'affaires", `${money(totals.ca)} FCFA`],
    ["Prix d'achat", `${money(totals.achat)} FCFA`],
    ["Quantité restante en stock", num(totals.stock)],
  ];
  const boxW = 90;
  const boxH = 8 + summary.length * 6;
  if (y + 6 + boxH > bottomLimit) {
    doc.addPage();
    y = getPdfChromeBodyTop() - 18;
  }
  const bx = pageW - MARGIN_X - boxW;
  const by = y + 6;
  doc.setFillColor(186, 230, 253);
  doc.setDrawColor(125, 211, 252);
  doc.setLineWidth(0.5);
  doc.roundedRect(bx, by, boxW, boxH, 2, 2, "FD");
  doc.setFontSize(8);
  doc.setTextColor(12, 74, 110);
  summary.forEach(([label, value], i) => {
    const ry = by + 7 + i * 6;
    doc.setFont("helvetica", "normal");
    doc.text(safe(label), bx + 4, ry);
    doc.setFont("helvetica", "bold");
    doc.text(safe(value), bx + boxW - 4, ry, { align: "right" });
  });

  // Pied de page simplifié + pagination sur toutes les pages
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.3);
    doc.line(MARGIN_X, pageH - FOOTER_H, pageW - MARGIN_X, pageH - FOOTER_H);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(110, 110, 110);
    doc.text("EDITIONS FABS-CI - Rapport produits", MARGIN_X, pageH - FOOTER_H + 5);
    doc.text(`Page ${p} / ${total}`, pageW - MARGIN_X, pageH - FOOTER_H + 5, { align: "right" });
  }

  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  doc.save(`rapport-produits-${stamp}.pdf`);
}
