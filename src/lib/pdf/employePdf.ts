import type jsPDF from "jspdf";
import { formatFCFA, formatDateTime } from "@/lib/format";
import { PDF_COLORS, PDF_TABLE, getActiveTemplate } from "@/lib/pdf/pdfConfig";
import {
  drawHeader,
  drawFooter,
  addPageNumbers,
  getPdfChromeBodyTop,
  ensurePdfLogo,
  ensurePdfQr,
  clearPdfQr,
} from "@/lib/pdf/pdfChrome";
import { DEPARTEMENT_LABEL, type Employe } from "@/lib/rh-api";

async function loadPdfLibs() {
  const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  return { JsPDF, autoTable };
}

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

export async function generateEmployeFichePDF(emp: Employe): Promise<void> {
  await ensurePdfLogo();
  const fileBase = `Fiche_${emp.matricule}_${emp.nom_complet.replace(/\s+/g, "_")}`;
  await ensurePdfQr(fileBase);
  const { JsPDF, autoTable } = await loadPdfLibs();
  const doc = new JsPDF();
  const t = getActiveTemplate();

  const sections: Array<[string, Array<[string, string]>]> = [
    [
      "Identité",
      [
        ["Matricule", fmt(emp.matricule)],
        ["Nom", fmt(emp.nom_complet)],
        ["Prénom", fmt(emp.prenoms)],
        ["Sexe", fmt(emp.sexe)],
        ["Date de naissance", fmt(emp.date_naissance)],
        ["Lieu de naissance", fmt(emp.lieu_naissance)],
        ["Nationalité", fmt(emp.nationalite)],
        ["Situation matrimoniale", fmt(emp.situation_matrimoniale)],
        ["N° CNI", fmt(emp.numero_cni)],
        ["N° CNPS", fmt(emp.numero_cnps)],
      ],
    ],
    [
      "Contact",
      [
        ["Email", fmt(emp.email)],
        ["Téléphone", fmt(emp.telephone)],
        ["Téléphone secondaire", fmt(emp.telephone_secondaire)],
        ["Adresse", fmt(emp.adresse)],
        ["Commune", fmt(emp.commune)],
        ["Ville", fmt(emp.ville)],
        ["Pays", fmt(emp.pays)],
      ],
    ],
    [
      "Professionnel",
      [
        ["Poste", fmt(emp.poste)],
        ["Département", DEPARTEMENT_LABEL[emp.departement] ?? fmt(emp.departement)],
        ["Service", fmt(emp.service)],
        ["Type de contrat", fmt(emp.type_contrat)],
        ["Date d'embauche", fmt(emp.date_embauche)],
        ["Date fin de contrat", fmt(emp.date_fin_contrat)],
        ["Statut", emp.actif ? "Actif" : "Inactif"],
        ["Catégorie", fmt(emp.categorie)],
        ["Échelon", fmt(emp.echelon)],
        ["Site d'affectation", fmt(emp.site_affectation)],
      ],
    ],
    [
      "Rémunération",
      [
        ["Salaire de base", formatFCFA(Number(emp.salaire) || 0)],
        ["Mode de paiement", fmt(emp.mode_paiement)],
        ["Banque", fmt(emp.banque)],
        ["N° de compte", fmt(emp.numero_compte)],
        ["Devise", fmt(emp.devise)],
      ],
    ],
    [
      "Contact d'urgence",
      [
        ["Nom", fmt(emp.contact_urgence_nom)],
        ["Téléphone", fmt(emp.contact_urgence_telephone)],
        ["Lien", fmt(emp.contact_urgence_lien)],
      ],
    ],
  ];

  let startY = getPdfChromeBodyTop();
  const drawChrome = (d: jsPDF) => {
    drawHeader(d, "FICHE EMPLOYÉ", t);
    d.setFontSize(9);
    d.setFont("helvetica", "normal");
    d.setTextColor(...PDF_COLORS.black);
    d.text(`${emp.matricule} — ${emp.nom_complet}`, 14, 36);
    d.setFontSize(8);
    d.setTextColor(...PDF_COLORS.muted);
    d.text(
      `Généré le ${formatDateTime(new Date())}`,
      d.internal.pageSize.getWidth() - 14,
      36,
      {
        align: "right",
      },
    );
    drawFooter(d, "Fiche employé — Document interne confidentiel.", t);
  };

  for (const [titre, rows] of sections) {
    autoTable(doc, {
      startY,
      head: [[titre, ""]],
      body: rows,
      headStyles: PDF_TABLE.headStyles,
      styles: { fontSize: 9, cellPadding: 2.6 },
      bodyStyles: PDF_TABLE.bodyStyles,
      columnStyles: { 0: { cellWidth: 60, fontStyle: "bold" } },
      margin: { left: 14, right: 14, top: getPdfChromeBodyTop(), bottom: 52 },
      didDrawPage: () => drawChrome(doc),
    });
    // @ts-expect-error autotable adds lastAutoTable
    startY = (doc.lastAutoTable?.finalY ?? startY) + 6;
  }

  addPageNumbers(doc);
  doc.save(`${fileBase}.pdf`);
  clearPdfQr();
}
