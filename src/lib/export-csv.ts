import type { CellDef, RowInput, UserOptions } from "jspdf-autotable";
import { PDF_TABLE, PDF_COLORS, getActiveTemplate } from "@/lib/pdf/pdfConfig";
import {
  drawHeader,
  drawFooter,
  addPageNumbers,
  getPdfChromeBodyTop,
  ensurePdfLogo,
} from "@/lib/pdf/pdfChrome";

export type PdfCell = string | number | null | CellDef;

/**
 * Exporte des données tabulaires en PDF avec en-tête / pied de page identiques
 * aux autres documents (factures, BL, bulletins). Nom historique `exportCsv`
 * conservé pour compatibilité.
 */
export function exportCsv(
  filename: string,
  headers: (string | CellDef)[],
  rows: PdfCell[][],
  options?: {
    columnStyles?: UserOptions["columnStyles"];
    headStyles?: UserOptions["headStyles"];
    pageTitle?: string;
    summary?: Array<{ label: string; value: string }>;
  },
) {
  return exportPdf(filename, headers, rows, options);
}

export async function exportPdf(
  filename: string,
  headers: (string | CellDef)[],
  rows: PdfCell[][],
  options?: {
    columnStyles?: UserOptions["columnStyles"];
    headStyles?: UserOptions["headStyles"];
    pageTitle?: string;
    summary?: Array<{ label: string; value: string }>;
  },
) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  await ensurePdfLogo();

  const t = getActiveTemplate();
  const isProduitList = options?.pageTitle?.includes("LISTE DES PRODUITS");
  const orientation = isProduitList ? "portrait" : (headers.length > 6 ? "landscape" : "portrait");
  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
  // Le titre du document est rendu par `pageTitle` (bandeau centré) ;
  // on ne réutilise plus le nom de fichier pour éviter un doublon type
  // « Liste Produits Fabs 2026 07 01 » dans l'en-tête.
  const titre = options?.pageTitle
    ? ""
    : filename.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const body: RowInput[] = rows.map((r) =>
    r.map((v) => (v == null ? "" : typeof v === "object" ? v : String(v))),
  );

  // En-têtes de tableau en orange soutenu (charte FABS-CI) par défaut,
  // meilleur contraste que le navy pour les listes internes.
  const defaultHead = {
    ...PDF_TABLE.headStyles,
    fillColor: [204, 78, 0] as [number, number, number],
    textColor: PDF_COLORS.white,
    fontStyle: "bold" as const,
    halign: "center" as const,
  };

  // Bandeau titre centré + date de génération sous l'en-tête chrome.
  const bodyTop = getPdfChromeBodyTop();
  let tableStartY = bodyTop;
  if (options?.pageTitle) {
    const pageW = doc.internal.pageSize.getWidth();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(204, 78, 0);
    doc.text(options.pageTitle, pageW / 2, bodyTop + 2, { align: "center" });
    const now = new Date();
    const d = now.toLocaleDateString("fr-FR");
    const h = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(`Édité le : ${d} à ${h}`, pageW / 2, bodyTop + 7.5, { align: "center" });
    tableStartY = bodyTop + 12;
  }

  autoTable(doc, {
    startY: tableStartY,
    head: [headers],
    body,
    styles: {
      fontSize: 9,
      cellPadding: 3,
      overflow: "visible", // Empêche les coupures de texte
      valign: "middle",
      font: t.font,
      lineColor: [220, 220, 220],
      lineWidth: 0.15,
      fontStyle: "normal",
      minCellHeight: 8,
    },
    bodyStyles: { fontStyle: "normal", textColor: [20, 20, 20] },
    alternateRowStyles: { fillColor: [247, 247, 247] }, // Gris clair #F7F7F7
    headStyles: {
      ...(options?.headStyles ?? defaultHead),
      cellPadding: 4,
      overflow: "visible", // Crucial pour ne pas couper les en-têtes
      minCellHeight: 10,
    },
    margin: { top: getPdfChromeBodyTop(), bottom: 52, left: 10, right: 10 },
    showHead: "everyPage",
    columnStyles: options?.columnStyles,
  });

  // Bloc récapitulatif sur la dernière page (avant le pied de page).
  // Charte ERP §21.6 : un récapitulatif est TOUJOURS présent sur tous les
  // rapports/exports. Si l'appelant ne fournit rien, on affiche au minimum
  // le nombre total de lignes exportées afin d'harmoniser la présentation
  // avec le PDF « Liste des produits ».
  const summary =
    options?.summary && options.summary.length > 0
      ? options.summary
      : [{ label: "Nombre total de lignes", value: String(rows.length) }];
  {
    const lastAutoTable = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
    const pageW = doc.internal.pageSize.getWidth();
    const boxW = Math.min(180, pageW - 20);
    const rowH = 10;
    const boxH = 16 + summary.length * rowH;
    const footerTop = doc.internal.pageSize.getHeight() - 52;
    let y = (lastAutoTable?.finalY ?? tableStartY) + 8;
    if (y + boxH > footerTop) {
      doc.addPage();
      y = getPdfChromeBodyTop();
    } else {
      doc.setPage(doc.getNumberOfPages());
    }
    const x = pageW - boxW - 10;
    doc.setFillColor(186, 230, 253);
    doc.setDrawColor(125, 211, 252);
    doc.setLineWidth(0.8);
    doc.roundedRect(x, y, boxW, boxH, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(12, 74, 110);
    doc.text("Récapitulatif", x + 5, y + 9);
    doc.setFontSize(12);
    summary.forEach((s, i) => {
      const ry = y + 16 + i * rowH;
      doc.setFont("helvetica", "bold");
      doc.setTextColor(12, 74, 110);
      doc.text(s.label, x + 5, ry);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(12, 74, 110);
      doc.text(s.value, x + boxW - 5, ry, { align: "right" });
    });
  }

  // Règle ERP §21.4 : en-tête uniquement sur la 1re page, pied de page
  // uniquement sur la dernière page, pagination continue sur toutes les pages.
  const total = doc.getNumberOfPages();
  doc.setPage(1);
  drawHeader(doc, options?.pageTitle || titre, t, { titleInBody: Boolean(options?.pageTitle) });
  // Pied de page complet (adresse, banques, signature) uniquement
  // sur la dernière page ; les pages intermédiaires restent épurées.
  doc.setPage(total);
  drawFooter(doc, "", t, {
    hideLogo: true,
    signatureColor: [0, 0, 0],
    signatureFontStyle: "bold",
  });
  addPageNumbers(doc);
  doc.save(`${filename}.pdf`);
}
