// Dossier PDF complet des états financiers, dans l'ordre de la liasse : page de
// garde, bilan actif, bilan passif, compte de résultat, TFT, notes annexes et
// contrôles. Chaque page porte l'identification de l'entité et l'exercice (comme
// les en-têtes du modèle DGI) et sa pagination « Page x / n ».

import { jsPDF } from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";

import {
  LIGNES_ACTIF,
  LIGNES_PASSIF,
  LIGNES_RESULTAT,
  type Ligne,
} from "@/lib/etats-financiers/syscohada";
import { LIGNES_TFT } from "@/lib/etats-financiers/tft";
import type { EtatsPourXml } from "@/lib/etats-financiers/xml-edi";
import type { NoteCalculee } from "@/lib/etats-financiers/notes";
import type { NoteTableau } from "@/lib/etats-financiers/notes-immobilisations";
import { dureeMois, type Controle } from "@/lib/etats-financiers/controles";

export type EtatsPourPdf = EtatsPourXml & {
  notes: NoteCalculee[];
  /** Notes 3A, 3C, 3C BIS, 3D (absentes des dossiers enregistrés avant leur ajout). */
  immobilisations?: NoteTableau[];
};

export type ParametresPdf = {
  n: EtatsPourPdf;
  n1?: EtatsPourPdf;
  exercice: { date_debut: string; date_fin: string; libelle: string };
  exerciceN1?: { libelle: string } | null;
  identite: { denomination?: string; sigle?: string; adresse?: string; ncc?: string; ntd?: string };
  controles: Controle[];
  /** Version du dossier (« Version 3 — validée le … ») ; absent : données actuelles. */
  version?: string;
};

export type Section = "garde" | "actif" | "passif" | "resultat" | "tft" | "notes" | "controles";
export const ORDRE_SECTIONS: Section[] = [
  "garde",
  "actif",
  "passif",
  "resultat",
  "tft",
  "notes",
  "controles",
];

const ORANGE: [number, number, number] = [204, 78, 0];
const MARGE = 10;

/** Montant au format de la liasse : 1 234 567, négatif entre parenthèses ; vide si inconnu. */
export function montantPdf(v: number | undefined | null): string {
  if (v == null) return "";
  const n = Math.round(v);
  if (n === 0) return "-";
  const s = Math.abs(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return n < 0 ? `(${s})` : s;
}

const dateFr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

// Polices standard du PDF : jeu WinAnsi (Latin-1 et quelques signes). Un autre
// caractère (« − » des libellés du TFT…) fait basculer jsPDF en Unicode et
// déforme toute la ligne : il est remplacé, les accents sont conservés.
const WINANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
const EQUIVALENTS: Record<string, string> = {
  "−": "-",
  "‑": "-",
  "‐": "-",
  " ": " ",
  " ": " ",
  "≠": "<>",
  "≤": "<=",
  "≥": ">=",
  "→": "->",
};
export function texteWinAnsi(s: string): string {
  return [...s]
    .map((c) =>
      c.charCodeAt(0) <= 0xff || WINANSI_EXTRA.includes(c) ? c : (EQUIVALENTS[c] ?? "?"),
    )
    .join("");
}

const ecrire = (
  doc: jsPDF,
  s: string,
  x: number,
  y: number,
  o?: { align?: "left" | "center" | "right" },
) => doc.text(texteWinAnsi(s), x, y, o);

function entete(doc: jsPDF, p: ParametresPdf, titre: string) {
  const w = doc.internal.pageSize.getWidth();
  const id = p.identite;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(40, 40, 40);
  ecrire(
    doc,
    `Dénomination sociale : ${id.denomination ?? ""}${id.sigle ? ` (${id.sigle})` : ""}`,
    MARGE,
    10,
  );
  ecrire(doc, `Adresse : ${id.adresse ?? ""}`, MARGE, 14);
  ecrire(doc, `NCC : ${id.ncc ?? ""}    NTD : ${id.ntd ?? ""}`, MARGE, 18);
  ecrire(
    doc,
    `Exercice clos le : ${dateFr(p.exercice.date_fin)}    Durée (en mois) : ${dureeMois(p.exercice.date_debut, p.exercice.date_fin)}`,
    w - MARGE,
    18,
    { align: "right" },
  );
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...ORANGE);
  ecrire(doc, titre, w / 2, 27, { align: "center" });
  doc.setTextColor(0, 0, 0);
}

function tableau(
  doc: jsPDF,
  p: ParametresPdf,
  titre: string,
  head: string[],
  body: RowInput[],
  totaux: Set<number>,
  numeriques: number[],
) {
  entete(doc, p, titre);
  const propre = (v: unknown) => (typeof v === "string" ? texteWinAnsi(v) : v);
  autoTable(doc, {
    startY: 31,
    head: [head.map(texteWinAnsi)],
    body: body.map((r) => (Array.isArray(r) ? r.map(propre) : r)) as RowInput[],
    theme: "grid",
    styles: { fontSize: 7.5, cellPadding: 1.2, lineColor: [200, 200, 200], lineWidth: 0.1 },
    headStyles: { fillColor: ORANGE, textColor: 255, fontStyle: "bold", halign: "center" },
    columnStyles: Object.fromEntries(numeriques.map((i) => [i, { halign: "right" as const }])),
    margin: { left: MARGE, right: MARGE, top: 31, bottom: 14 },
    // Tableau coupé : l'en-tête d'identification est repris sur la page suivante.
    willDrawPage: (d) => {
      if (d.pageNumber > 1) entete(doc, p, `${titre} (suite)`);
    },
    didParseCell: (d) => {
      if (d.section === "body" && totaux.has(d.row.index)) {
        d.cell.styles.fontStyle = "bold";
        d.cell.styles.fillColor = [242, 242, 242];
      }
    },
  });
}

const indexTotaux = (lignes: Ligne[]) => new Set(lignes.flatMap((l, i) => (l.somme ? [i] : [])));

function pageGarde(doc: jsPDF, p: ParametresPdf) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...ORANGE);
  ecrire(doc, "ÉTATS FINANCIERS ANNUELS", w / 2, 60, { align: "center" });
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  ecrire(doc, "SYSCOHADA révisé — Système normal", w / 2, 70, { align: "center" });
  doc.setFontSize(16);
  ecrire(doc, p.identite.denomination ?? "", w / 2, 95, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const lignes = [
    ["Sigle", p.identite.sigle],
    ["Adresse", p.identite.adresse],
    ["N° de compte contribuable (NCC)", p.identite.ncc],
    ["N° de télédéclarant (NTD)", p.identite.ntd],
    ["Exercice", `du ${dateFr(p.exercice.date_debut)} au ${dateFr(p.exercice.date_fin)}`],
    ["Durée (en mois)", String(dureeMois(p.exercice.date_debut, p.exercice.date_fin))],
    ["Exercice comparatif (N-1)", p.n1 ? (p.exerciceN1?.libelle ?? "") : "aucune donnée"],
    ["Dossier", p.version ?? "données actuelles, non enregistrées"],
  ] as const;
  let y = 115;
  for (const [l, v] of lignes) {
    doc.setFont("helvetica", "bold");
    ecrire(doc, `${l} :`, 40, y);
    doc.setFont("helvetica", "normal");
    ecrire(doc, v || "À compléter", 110, y);
    y += 8;
  }
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  ecrire(doc, "Sommaire : bilan actif, bilan passif, compte de résultat,", 40, y + 10);
  ecrire(doc, "tableau des flux de trésorerie, notes annexes, contrôles.", 40, y + 15);
  doc.setTextColor(0, 0, 0);
}

/** Notes 3 : tableaux de mouvements en paysage, hypothèses sous le tableau. */
function pagesImmobilisations(doc: jsPDF, p: ParametresPdf, tableaux: NoteTableau[]) {
  tableaux.forEach((t, i) => {
    // La section commence sur une page portrait : remplacée par une page paysage.
    if (i === 0) doc.deletePage(doc.getNumberOfPages());
    doc.addPage("a4", "landscape");
    tableau(
      doc,
      p,
      `NOTE ${t.numero} : ${t.titre.toUpperCase()}`,
      ["Rubriques", ...t.colonnes.map((c) => c.libelle)],
      t.lignes.map((l) => [l.libelle, ...t.colonnes.map((c) => montantPdf(l.valeurs[c.cle]))]),
      new Set(t.lignes.flatMap((l, j) => (l.niveau === "detail" ? [] : [j]))),
      t.colonnes.map((_c, j) => j + 1),
    );
    const notes = [
      ...t.hypotheses.map((h) => `Hypothèse : ${h}.`),
      "Case vide : montant non disponible dans la comptabilité, à compléter.",
    ];
    let y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(90, 90, 90);
    for (const n of notes) {
      const lignes = doc.splitTextToSize(
        texteWinAnsi(n),
        doc.internal.pageSize.getWidth() - 2 * MARGE,
      );
      doc.text(lignes, MARGE, y);
      y += 3.6 * lignes.length;
    }
    doc.setTextColor(0, 0, 0);
  });
  // Les autres notes reprennent en portrait.
  if (tableaux.length && p.n.notes.length) doc.addPage("a4", "portrait");
}

function pageNotes(doc: jsPDF, p: ParametresPdf) {
  const nomN = p.exercice.libelle;
  const nomN1 = p.exerciceN1?.libelle ?? "N-1";
  pagesImmobilisations(doc, p, p.n.immobilisations ?? []);
  p.n.notes.forEach((note, i) => {
    if (i > 0) doc.addPage("a4", "portrait");
    const n1 = new Map(
      p.n1?.notes.find((x) => x.numero === note.numero)?.lignes.map((l) => [l.libelle, l.montant]),
    );
    tableau(
      doc,
      p,
      `NOTE ${note.numero} : ${note.titre.toUpperCase()}`,
      ["Libellés", nomN, nomN1],
      note.lignes.map((l) => [
        l.libelle,
        montantPdf(l.montant),
        p.n1 ? montantPdf(n1.get(l.libelle) ?? 0) : "",
      ]),
      new Set(note.lignes.flatMap((l, j) => (l.niveau === "detail" ? [] : [j]))),
      [1, 2],
    );
  });
}

function pageControles(doc: jsPDF, p: ParametresPdf) {
  const libelle = { bloquant: "Bloquant", avertissement: "À vérifier", info: "Info" } as const;
  tableau(
    doc,
    p,
    "CONTRÔLES DU DOSSIER",
    ["Niveau", "Constat"],
    p.controles.length
      ? p.controles.map((c) => [libelle[c.niveau], c.message])
      : [["—", "Aucun point relevé."]],
    new Set(p.controles.flatMap((c, i) => (c.niveau === "bloquant" ? [i] : []))),
    [],
  );
}

/** Ajoute « Page x / n » sur toutes les pages. */
function paginer(doc: jsPDF) {
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(90, 90, 90);
    ecrire(doc, `Page ${i} / ${n}`, w - MARGE, h - 6, { align: "right" });
  }
}

export function genererDossierPdf(p: ParametresPdf, sections: Section[] = ORDRE_SECTIONS): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const nomN = p.exercice.libelle;
  const nomN1 = p.exerciceN1?.libelle ?? "N-1";
  const v1 = (f: (e: EtatsPourPdf) => number | undefined) => (p.n1 ? montantPdf(f(p.n1) ?? 0) : "");

  sections.forEach((s, i) => {
    // L'actif a 7 colonnes : paysage, pour ne couper aucune colonne.
    if (i > 0) doc.addPage("a4", s === "actif" ? "landscape" : "portrait");
    else if (s === "actif") {
      doc.deletePage(1);
      doc.addPage("a4", "landscape");
    }
    if (s === "garde") pageGarde(doc, p);
    if (s === "actif")
      tableau(
        doc,
        p,
        "BILAN — ACTIF",
        ["Réf", "Actif", "Note", "Brut", "Amort. et dépréc.", `Net ${nomN}`, `Net ${nomN1}`],
        LIGNES_ACTIF.map((l) => [
          l.ref,
          l.libelle,
          l.note ?? "",
          montantPdf(p.n.actif[l.ref]?.brut ?? 0),
          montantPdf(p.n.actif[l.ref]?.amort ?? 0),
          montantPdf(p.n.actif[l.ref]?.net ?? 0),
          v1((e) => e.actif[l.ref]?.net),
        ]),
        indexTotaux(LIGNES_ACTIF),
        [3, 4, 5, 6],
      );
    const simple = (
      titre: string,
      lignes: Ligne[],
      val: (e: EtatsPourPdf) => Record<string, number>,
    ) =>
      tableau(
        doc,
        p,
        titre,
        ["Réf", "Libellé", "Note", nomN, nomN1],
        lignes.map((l) => [
          l.ref,
          l.libelle,
          l.note ?? "",
          montantPdf(val(p.n)[l.ref] ?? 0),
          v1((e) => val(e)[l.ref]),
        ]),
        indexTotaux(lignes),
        [3, 4],
      );
    if (s === "passif") simple("BILAN — PASSIF", LIGNES_PASSIF, (e) => e.passif);
    if (s === "resultat") simple("COMPTE DE RÉSULTAT", LIGNES_RESULTAT, (e) => e.resultat);
    if (s === "tft") simple("TABLEAU DES FLUX DE TRÉSORERIE", LIGNES_TFT, (e) => e.tft.valeurs);
    if (s === "notes") pageNotes(doc, p);
    if (s === "controles") pageControles(doc, p);
  });

  paginer(doc);
  return doc;
}

export function nomFichierPdf(annee: string, section?: Section) {
  return section
    ? `ETATS_FINANCIERS_FABS_CI_${annee}_${section.toUpperCase()}.pdf`
    : `ETATS_FINANCIERS_FABS_CI_${annee}.pdf`;
}
