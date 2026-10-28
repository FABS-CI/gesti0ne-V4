import { formatFCFA } from "@/lib/format";
import { PDF_COLORS, PDF_MARGINS, PDF_TABLE, getActiveTemplate } from "@/lib/pdf/pdfConfig";
import {
  drawHeader as sharedDrawHeader,
  drawFooter as sharedDrawFooter,
  addPageNumbers as sharedAddPageNumbers,
  getPdfChromeBodyTop,
  ensurePdfLogo,
  ensurePdfQr,
  clearPdfQr,
} from "@/lib/pdf/pdfChrome";
import type { DeclLigne, DeclTotaux } from "@/lib/paie/declaration-lignes";

export {
  computeLignes,
  computeTotaux,
  periodesTriees,
  type BulletinDeclare,
  type DeclLigne,
  type DeclTotaux,
} from "@/lib/paie/declaration-lignes";

export type PdfOpts = {
  title: string;
  subtitle: string;
  footerText: string;
  fileName: string;
  head: string[][];
  body: string[][];
  foot: string[][];
};

export function slug(s: string): string {
  return s.replace(/\s+/g, "_").replace(/[^\w-]/g, "");
}

export function buildDeclOptions(
  periode: string,
  lignes: DeclLigne[],
  totaux: DeclTotaux,
) {
  const cnps: PdfOpts = {
    title: "DÉCLARATION CNPS",
    subtitle: `Période ${periode}`,
    footerText:
      "Déclaration mensuelle CNPS — Retraite, Prestations Familiales, Accident du Travail.",
    fileName: `Declaration_CNPS_${slug(periode)}.pdf`,
    head: [
      ["Employé", "Brut", "CNPS Sal.", "CNPS Patr.", "PF+Mat.+AT", "CMU Sal.", "CMU Patr."],
    ],
    body: lignes.map((l) => [
      l.employe,
      formatFCFA(l.brut),
      formatFCFA(l.cnpsSalarie),
      formatFCFA(l.cnpsPatronal),
      formatFCFA(l.pfAt),
      formatFCFA(l.cmuSalarie),
      formatFCFA(l.cmuPatronal),
    ]),
    foot: [
      [
        "TOTAUX",
        formatFCFA(totaux.brut),
        formatFCFA(totaux.cnpsSalarie),
        formatFCFA(totaux.cnpsPatronal),
        formatFCFA(totaux.pfAt),
        formatFCFA(totaux.cmuSalarie),
        formatFCFA(totaux.cmuPatronal),
      ],
    ],
  };

  const its: PdfOpts = {
    title: "DÉCLARATION ITS / CN",
    subtitle: `Période ${periode}`,
    footerText:
      "Impôt sur Traitements et Salaires + Contribution Nationale — Reversement mensuel DGI.",
    fileName: `Declaration_ITS_${slug(periode)}.pdf`,
    head: [["Employé", "Brut", "ITS", "CN", "Total à reverser"]],
    body: lignes.map((l) => [
      l.employe,
      formatFCFA(l.brut),
      formatFCFA(l.its),
      formatFCFA(l.cn),
      formatFCFA(l.its + l.cn),
    ]),
    foot: [
      [
        "TOTAUX",
        formatFCFA(totaux.brut),
        formatFCFA(totaux.its),
        formatFCFA(totaux.cn),
        formatFCFA(totaux.its + totaux.cn),
      ],
    ],
  };

  const disa: PdfOpts = {
    title: "DISA — DÉCLARATION SOCIALE ANNUELLE (Synthèse)",
    subtitle: `Période ${periode}`,
    footerText:
      "Récapitulatif employé — Assiette CNPS, contributions salariales et patronales, net perçu.",
    fileName: `DISA_${slug(periode)}.pdf`,
    head: [["Employé", "Brut", "CNPS Sal.", "CNPS Patr.", "ITS", "CN", "CMU", "Net"]],
    body: lignes.map((l) => [
      l.employe,
      formatFCFA(l.brut),
      formatFCFA(l.cnpsSalarie),
      formatFCFA(l.cnpsPatronal),
      formatFCFA(l.its),
      formatFCFA(l.cn),
      formatFCFA(l.cmuSalarie + l.cmuPatronal),
      formatFCFA(l.net),
    ]),
    foot: [
      [
        "TOTAUX",
        formatFCFA(totaux.brut),
        formatFCFA(totaux.cnpsSalarie),
        formatFCFA(totaux.cnpsPatronal),
        formatFCFA(totaux.its),
        formatFCFA(totaux.cn),
        formatFCFA(totaux.cmuSalarie + totaux.cmuPatronal),
        formatFCFA(totaux.net),
      ],
    ],
  };

  return { cnps, its, disa };
}

export async function buildPdf(
  opts: PdfOpts,
  mode: "save" | "blob" = "save",
): Promise<string | void> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  await ensurePdfLogo();
  await ensurePdfQr(opts.fileName.replace(/\.pdf$/, ""));
  const doc = new jsPDF({ orientation: "landscape" });
  const t = getActiveTemplate();
  const generatedAt = `Généré le ${new Date().toLocaleString("fr-FR")}`;

  autoTable(doc, {
    startY: getPdfChromeBodyTop(),
    head: opts.head,
    body: opts.body,
    foot: opts.foot,
    headStyles: PDF_TABLE.headStyles,
    footStyles: PDF_TABLE.footStyles,
    styles: { fontSize: PDF_TABLE.journalFontSize },
    columnStyles: Object.fromEntries(
      opts.head[0].slice(1).map((_, i) => [i + 1, { halign: "right" as const }]),
    ),
    margin: { ...PDF_MARGINS.journal, top: getPdfChromeBodyTop(), bottom: 52 },
    didDrawPage: () => {
      sharedDrawHeader(doc, opts.title, t);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...PDF_COLORS.black);
      doc.text(opts.subtitle, 14, 36);
      doc.setFontSize(8);
      doc.setTextColor(...PDF_COLORS.muted);
      doc.text(generatedAt, doc.internal.pageSize.getWidth() - 14, 36, { align: "right" });
      sharedDrawFooter(doc, opts.footerText, t);
    },
  });
  sharedAddPageNumbers(doc);
  if (mode === "blob") {
    const url = doc.output("bloburl").toString();
    clearPdfQr();
    return url;
  }
  doc.save(opts.fileName);
  clearPdfQr();
}
