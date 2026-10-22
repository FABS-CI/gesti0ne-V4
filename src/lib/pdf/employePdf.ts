import type jsPDF from "jspdf";
import { formatFCFA, formatDateTime } from "@/lib/format";
import { PDF_COLORS, PDF_TABLE, getActiveTemplate } from "@/lib/pdf/pdfConfig";
import {
  drawHeader,
  drawFooter,
  addPageNumbers,
  getPdfChromeBodyTop,
  ensurePdfLogo,
} from "@/lib/pdf/pdfChrome";
import { DEPARTEMENT_LABEL, SEXES, situationsAccordees, type Employe } from "@/lib/rh-api";

async function loadPdfLibs() {
  const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  return { JsPDF, autoTable };
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}
function dateFr(v: unknown): string {
  const s = fmt(v);
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
}
function tel(v: unknown): string {
  const d = fmt(v).replace(/\s+/g, "");
  return /^\+?\d{8,}$/.test(d) ? d.replace(/(\d{2})(?=\d)/g, "$1 ").trim() : fmt(v);
}

export async function generateEmployeFichePDF(emp: Employe): Promise<void> {
  await ensurePdfLogo();
  const fileBase = `Fiche_${emp.matricule}_${emp.nom_complet.replace(/\s+/g, "_")}`;
  const { JsPDF, autoTable } = await loadPdfLibs();
  const doc = new JsPDF();
  const t = getActiveTemplate();

  const sections: Array<[string, Array<[string, string]>]> = [
    [
      "Identité",
      [
        ["Civilité", fmt(emp.civilite)],
        ["Matricule", fmt(emp.matricule)],
        ["Nom", fmt(emp.nom_complet)],
        ["Prénoms", fmt(emp.prenoms)],
        ["Sexe", SEXES.find((x) => x.value === emp.sexe)?.label ?? fmt(emp.sexe)],
        ["Date de naissance", dateFr(emp.date_naissance)],
        ["Lieu de naissance", fmt(emp.lieu_naissance)],
        ["Nationalité", fmt(emp.nationalite)],
        ["Situation matrimoniale", situationsAccordees(emp.sexe).find((x) => x.value === emp.situation_matrimoniale)?.label ?? fmt(emp.situation_matrimoniale)],
        ["N° CNI", fmt(emp.numero_cni)],
        ["N° CNPS", fmt(emp.numero_cnps)],
      ],
    ],
    [
      "Contact",
      [
        ["Email", fmt(emp.email)],
        ["Téléphone", tel(emp.telephone)],
        ["Téléphone secondaire", fmt(emp.telephone_secondaire)],
        ["Lieu de résidence", fmt(emp.adresse)],
        ["Commune", fmt(emp.commune)],
        ["Ville", fmt(emp.ville)],
        ["Pays", fmt(emp.pays)],
      ],
    ],
    [
      "Professionnel",
      [
        ["Poste", fmt(emp.poste)],
        ["Département", (emp.departement && DEPARTEMENT_LABEL[emp.departement]) || fmt(emp.departement)],
        ["Service", fmt(emp.service)],
        ["Type de contrat", fmt(emp.type_contrat)],
        ["Date d'embauche", dateFr(emp.date_embauche)],
        ["Date fin de contrat", dateFr(emp.date_fin_contrat)],
        ["Statut", emp.actif ? "Actif" : "Inactif"],
        ["Catégorie", fmt(emp.categorie)],
        ["Échelon", fmt(emp.echelon)],
        ["Site d'affectation", fmt(emp.site_affectation)],
      ],
    ],
    [
      "Rémunération",
      [
        ["Salaire de base", emp.salaire ? formatFCFA(Number(emp.salaire)) : ""],
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
        ["Téléphone", tel(emp.contact_urgence_telephone)],
        ["Lien", fmt(emp.contact_urgence_lien)],
      ],
    ],
  ];

  let startY = getPdfChromeBodyTop() + 2;
  const pageH = doc.internal.pageSize.getHeight();
  const drawChrome = (d: jsPDF) => {
    drawHeader(d, "FICHE EMPLOYÉ", t);
    d.setFontSize(9);
    d.setFont("helvetica", "normal");
    d.setTextColor(...PDF_COLORS.black);
    const top = getPdfChromeBodyTop() - 4;
    d.setFont("helvetica", "bold");
    d.text(
      [`${emp.civilite ? emp.civilite + " " : ""}${emp.nom_complet}`, emp.matricule, emp.poste, emp.actif ? "Actif" : "Inactif"]
        .filter(Boolean)
        .join("  ·  "),
      14,
      top,
    );
    d.setFont("helvetica", "normal");
    d.setFontSize(8);
    d.setTextColor(...PDF_COLORS.muted);
    d.text(
      `Généré le ${formatDateTime(new Date())}`,
      d.internal.pageSize.getWidth() - 14,
      top,
      {
        align: "right",
      },
    );
    drawFooter(d, "Fiche employé — Document interne confidentiel.", t);
  };

  for (const [titre, all] of sections) {
    const rows = all.filter(([, v]) => v !== "");
    if (!rows.length) continue;
    // Pas de titre orphelin : la section passe entière à la page suivante si besoin.
    if (startY + 9 + rows.length * 7 > pageH - 52 && startY > getPdfChromeBodyTop() + 10) {
      doc.addPage();
      startY = getPdfChromeBodyTop() + 2;
    }
    autoTable(doc, {
      rowPageBreak: "avoid",
      startY,
      head: [[titre, ""]],
      body: rows,
      headStyles: PDF_TABLE.headStyles,
      styles: { fontSize: 9, cellPadding: 2.6 },
      bodyStyles: PDF_TABLE.bodyStyles,
      columnStyles: { 0: { cellWidth: 60, textColor: PDF_COLORS.muted }, 1: { fontStyle: "bold" } },
      alternateRowStyles: { fillColor: [247, 248, 250] },
      margin: { left: 14, right: 14, top: getPdfChromeBodyTop(), bottom: 52 },
      didDrawPage: () => drawChrome(doc),
    });
    // @ts-expect-error autotable adds lastAutoTable
    startY = (doc.lastAutoTable?.finalY ?? startY) + 6;
  }

  addPageNumbers(doc);
  doc.save(`${fileBase}.pdf`);
}
