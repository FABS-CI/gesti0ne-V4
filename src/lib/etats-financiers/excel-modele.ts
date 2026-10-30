// Export Excel à partir du modèle de liasse (classeur DGI « EDITION FABS-CI 2025 »).
//
// Le classeur est modifié dans son fichier, cellule par cellule : formules, mise en
// forme, cellules fusionnées, zones d'impression et macros VBA restent intactes
// (un .xlsm reste un .xlsm). Seules changent :
//   - les cellules de montants des feuilles BILAN, RESULTAT et TFT, repérées par le
//     code du poste (AD, CA, TA, ZA…) et non par une position fixe ;
//   - les en-têtes d'identification (=SOCIETE, =NCC…), dont les noms définis
//     pointent vers un classeur externe absent : remplacés par leur valeur ;
//   - les lignes saisies des notes calculées par l'ERP (notes-modele.ts), les
//     autres lignes de ces notes étant vidées.
// Les feuilles ACTIF et PASSIF sont des formules sur BILAN : recalculées à
// l'ouverture (fullCalcOnLoad). Une feuille « ERP - LISEZ-MOI » ajoutée en fin de
// classeur liste ce qui a été mis à jour et ce qui reste à compléter.

import JSZip from "jszip";
import * as XLSX from "xlsx";

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
import { dureeMois } from "@/lib/etats-financiers/controles";
import {
  COLONNES_TABLEAUX_2025,
  CORRESPONDANCES_NOTES_2025,
  libelleComparable,
  type CorrespondanceNote,
} from "@/lib/etats-financiers/notes-modele";

type Valeur = number | string | null;

/** Colonne → valeur d'un poste (n : exercice N, n1 : N-1, absent si inconnu). */
type Colonnes = Record<string, (ref: string, n: EtatsPourXml, n1?: EtatsPourXml) => number | null>;

type Bloc = { feuille: string; colonneRef: string; lignes: Ligne[]; colonnes: Colonnes };

const net = (v: number | undefined) => Math.round(v ?? 0);
const siN1 = (n1: EtatsPourXml | undefined, f: (e: EtatsPourXml) => number | undefined) =>
  n1 ? net(f(n1)) : null;

/** Disposition du modèle DGI 2025 (système normal). */
export const BLOCS_MODELE_2025: Bloc[] = [
  {
    feuille: "BILAN",
    colonneRef: "A",
    lignes: LIGNES_ACTIF,
    colonnes: {
      F: (r, n) => net(n.actif[r]?.brut),
      G: (r, n) => net(n.actif[r]?.amort),
      H: (r, n) => net(n.actif[r]?.net),
      I: (r, _n, n1) => siN1(n1, (e) => e.actif[r]?.net),
    },
  },
  {
    feuille: "BILAN",
    colonneRef: "J",
    lignes: LIGNES_PASSIF,
    colonnes: {
      M: (r, n) => net(n.passif[r]),
      N: (r, _n, n1) => siN1(n1, (e) => e.passif[r]),
    },
  },
  {
    feuille: "RESULTAT",
    colonneRef: "A",
    lignes: LIGNES_RESULTAT,
    colonnes: {
      I: (r, n) => net(n.resultat[r]),
      J: (r, _n, n1) => siN1(n1, (e) => e.resultat[r]),
    },
  },
  {
    feuille: "TFT",
    colonneRef: "A",
    lignes: LIGNES_TFT,
    colonnes: {
      I: (r, n) => net(n.tft.valeurs[r]),
      J: (r, _n, n1) => siN1(n1, (e) => e.tft.valeurs[r]),
    },
  },
];

/** Feuilles recalculées par leurs formules à partir des feuilles remplies. */
const FEUILLES_CALCULEES = ["ACTIF", "PASSIF"];

export type IdentiteExport = {
  denomination?: string;
  sigle?: string;
  adresse?: string;
  ncc?: string;
  ntd?: string;
};

export type RapportExport = {
  cellules: number;
  /** Postes absents du modèle (feuille : code). */
  introuvables: string[];
  feuillesMisesAJour: string[];
  /** Feuilles contenant des montants saisis que l'ERP ne met pas à jour. */
  feuillesAVerifier: string[];
  /** Feuilles de notes remplies depuis les notes calculées. */
  notesRemplies: string[];
  /** Hypothèses faites pour placer des montants (zone, groupe), à vérifier. */
  hypotheses: string[];
  n1Absent: boolean;
};

export const NOM_FEUILLE_RAPPORT = "ERP - LISEZ-MOI";

export function nomFichierExcel(annee: string, macros: boolean) {
  return `ETATS_FINANCIERS_FABS_CI_${annee}.${macros ? "xlsm" : "xlsx"}`;
}

// ─── XML ─────────────────────────────────────────────────────────────────────
const echapper = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const colonneIndex = (adresse: string) => XLSX.utils.decode_cell(adresse).c;

function celluleXml(adresse: string, style: string, v: Valeur): string {
  if (v == null || v === "") return `<c r="${adresse}"${style}/>`;
  if (typeof v === "number") return `<c r="${adresse}"${style}><v>${v}</v></c>`;
  return `<c r="${adresse}"${style} t="inlineStr"><is><t xml:space="preserve">${echapper(v)}</t></is></c>`;
}

/**
 * Remplace la valeur d'une cellule (formule comprise) en gardant son style ; la
 * crée dans sa ligne si elle n'existe pas. false si la ligne est absente.
 */
export function ecrireCellule(
  xml: string,
  adresse: string,
  v: Valeur,
): { xml: string; ok: boolean } {
  const cellule = new RegExp(`<c\\b[^>]*?\\br="${adresse}"[^>]*?(?:/>|>[\\s\\S]*?</c>)`);
  const m = xml.match(cellule);
  if (m) {
    const style = m[0].match(/\bs="\d+"/)?.[0];
    return {
      xml: xml.replace(cellule, celluleXml(adresse, style ? ` ${style}` : "", v)),
      ok: true,
    };
  }
  const ligne = XLSX.utils.decode_cell(adresse).r + 1;
  const row = new RegExp(`<row\\b[^>]*?\\br="${ligne}"[^>]*?(/>|>([\\s\\S]*?)</row>)`);
  const r = xml.match(row);
  if (!r) return { xml, ok: false };
  const nouvelle = celluleXml(adresse, "", v);
  if (r[1] === "/>") {
    const ouverte = r[0].slice(0, -2) + `>${nouvelle}</row>`;
    return { xml: xml.replace(r[0], ouverte), ok: true };
  }
  // Cellules d'une ligne rangées par colonne.
  const contenu = r[2];
  const col = colonneIndex(adresse);
  let position = contenu.length;
  for (const c of contenu.matchAll(/<c\b[^>]*?\br="([A-Z]+\d+)"/g)) {
    if (colonneIndex(c[1]) > col) {
      position = c.index!;
      break;
    }
  }
  const rempli = contenu.slice(0, position) + nouvelle + contenu.slice(position);
  return { xml: xml.replace(r[0], r[0].replace(contenu, rempli)), ok: true };
}

function feuilleXml(lignes: string[][]): string {
  const rows = lignes
    .map(
      (cols, i) =>
        `<row r="${i + 1}">${cols
          .map((v, j) => celluleXml(XLSX.utils.encode_cell({ r: i, c: j }), "", v))
          .join("")}</row>`,
    )
    .join("");
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<cols><col min="1" max="1" width="40" customWidth="1"/><col min="2" max="2" width="90" customWidth="1"/></cols>` +
    `<sheetData>${rows}</sheetData></worksheet>`
  );
}

// ─── Remplissage ─────────────────────────────────────────────────────────────
/** Chemins des feuilles du classeur, par nom. */
async function cheminsFeuilles(zip: JSZip): Promise<Map<string, string>> {
  const wb = await zip.file("xl/workbook.xml")!.async("string");
  const rels = await zip.file("xl/_rels/workbook.xml.rels")!.async("string");
  const cibles = new Map<string, string>();
  for (const r of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = r[0].match(/\bId="([^"]+)"/)?.[1];
    const cible = r[0].match(/\bTarget="([^"]+)"/)?.[1];
    if (id && cible) cibles.set(id, cible.replace(/^\/?xl\//, "").replace(/^\//, ""));
  }
  const out = new Map<string, string>();
  for (const s of wb.matchAll(/<sheet\b[^>]*>/g)) {
    const nom = s[0].match(/\bname="([^"]+)"/)?.[1];
    const id = s[0].match(/\br:id="([^"]+)"/)?.[1];
    const cible = id && cibles.get(id);
    if (nom && cible) out.set(decoderXml(nom), `xl/${cible}`);
  }
  return out;
}

const decoderXml = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

/** Supprime la chaîne de calcul (périmée) et force le recalcul à l'ouverture. */
async function forcerRecalcul(zip: JSZip) {
  if (zip.file("xl/calcChain.xml")) {
    zip.remove("xl/calcChain.xml");
    const rels = await zip.file("xl/_rels/workbook.xml.rels")!.async("string");
    zip.file(
      "xl/_rels/workbook.xml.rels",
      rels.replace(/<Relationship\b[^>]*calcChain\.xml"[^>]*\/>/, ""),
    );
    const types = await zip.file("[Content_Types].xml")!.async("string");
    zip.file(
      "[Content_Types].xml",
      types.replace(/<Override\b[^>]*\/xl\/calcChain\.xml"[^>]*\/>/, ""),
    );
  }
  let wb = await zip.file("xl/workbook.xml")!.async("string");
  if (/<calcPr\b/.test(wb))
    wb = wb.replace(/<calcPr\b([^>]*?)(\/?)>/, (_m, attrs: string, fin: string) => {
      const a = attrs.replace(/\s*fullCalcOnLoad="[^"]*"/, "");
      return `<calcPr${a} fullCalcOnLoad="1"${fin}>`;
    });
  else wb = wb.replace(/<\/sheets>/, `</sheets><calcPr fullCalcOnLoad="1"/>`);
  zip.file("xl/workbook.xml", wb);
}

/** Ajoute une feuille en fin de classeur (les index des zones d'impression ne bougent pas). */
async function ajouterFeuille(zip: JSZip, nom: string, xml: string) {
  let wb = await zip.file("xl/workbook.xml")!.async("string");
  let rels = await zip.file("xl/_rels/workbook.xml.rels")!.async("string");
  let types = await zip.file("[Content_Types].xml")!.async("string");
  const ids = [...wb.matchAll(/<sheet\b[^>]*\bsheetId="(\d+)"/g)].map((m) => +m[1]);
  const sheetId = Math.max(0, ...ids) + 1;
  let n = sheetId;
  while (zip.file(`xl/worksheets/sheet${n}.xml`)) n++;
  const rId = `rIdErp${sheetId}`;
  zip.file(`xl/worksheets/sheet${n}.xml`, xml);
  rels = rels.replace(
    /<\/Relationships>/,
    `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${n}.xml"/></Relationships>`,
  );
  types = types.replace(
    /<\/Types>/,
    `<Override PartName="/xl/worksheets/sheet${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
  );
  wb = wb.replace(
    /<\/sheets>/,
    `<sheet name="${echapper(nom)}" sheetId="${sheetId}" r:id="${rId}"/></sheets>`,
  );
  zip.file("xl/workbook.xml", wb);
  zip.file("xl/_rels/workbook.xml.rels", rels);
  zip.file("[Content_Types].xml", types);
}

const NOMS_IDENTITE: Record<string, (p: ParametresExport) => Valeur> = {
  SOCIETE: (p) => p.identite.denomination ?? "",
  SIGLE: (p) => p.identite.sigle ?? "",
  ADRESSE: (p) => p.identite.adresse ?? "",
  NCC: (p) => p.identite.ncc ?? "",
  NTD: (p) => p.identite.ntd ?? "",
  CLOTURE: (p) => p.exercice.date_fin.slice(0, 10).split("-").reverse().join("/"),
  DUREE: (p) => dureeMois(p.exercice.date_debut, p.exercice.date_fin),
};

type EtatsExport = EtatsPourXml & { notes?: NoteCalculee[]; immobilisations?: NoteTableau[] };

export type ParametresExport = {
  modele: ArrayBuffer | Uint8Array;
  n: EtatsExport;
  n1?: EtatsExport;
  exercice: { date_debut: string; date_fin: string };
  identite: IdentiteExport;
  /** Lignes d'information ajoutées à la feuille de rapport (version du dossier…). */
  informations?: Array<[string, string]>;
  blocs?: Bloc[];
  correspondancesNotes?: Record<string, CorrespondanceNote[]>;
  colonnesTableaux?: Record<string, Record<string, string>>;
};

/**
 * Feuille « NOTE n » : colonnes « Année N » et « Année N-1 » de l'en-tête, et
 * lignes de saisie (sous l'en-tête, jusqu'au « Commentaire »), par libellé.
 */
function lireFeuilleNote(ws: XLSX.WorkSheet) {
  const plage = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  const texte = (r: number, c: number) => {
    const v = ws[XLSX.utils.encode_cell({ r, c })]?.v;
    return v == null ? "" : libelleComparable(String(v));
  };
  let entete = -1;
  let colN = -1;
  let colN1 = -1;
  for (let r = plage.s.r; r <= Math.min(plage.e.r, 20) && entete < 0; r++)
    for (let c = 1; c <= plage.e.c; c++) {
      if (texte(r, c) === "annee n") colN = c;
      if (texte(r, c) === "annee n-1") colN1 = c;
      if (colN >= 0 && colN1 >= 0) entete = r;
    }
  if (entete < 0) return null;
  const lignes = new Map<string, number>();
  let fin = entete + 1;
  for (; fin <= plage.e.r; fin++) {
    const libelle = texte(fin, 0);
    if (libelle.startsWith("commentaire")) break;
    if (libelle) lignes.set(libelle, fin);
  }
  return { colN, colN1, debut: entete + 1, fin: fin - 1, derniereColonne: plage.e.c, lignes };
}

export async function remplirModele(
  p: ParametresExport,
): Promise<{ fichier: ArrayBuffer; macros: boolean; rapport: RapportExport }> {
  const blocs = p.blocs ?? BLOCS_MODELE_2025;
  const lu = XLSX.read(p.modele, { type: "array", cellFormula: true });
  const zip = await JSZip.loadAsync(p.modele);
  const chemins = await cheminsFeuilles(zip);
  const macros = !!zip.file("xl/vbaProject.bin");
  const rapport: RapportExport = {
    cellules: 0,
    introuvables: [],
    feuillesMisesAJour: [],
    feuillesAVerifier: [],
    notesRemplies: [],
    hypotheses: [],
    n1Absent: !p.n1,
  };

  // Écritures par feuille : adresse → valeur.
  const ecritures = new Map<string, Map<string, Valeur>>();
  const ecrire = (feuille: string, adresse: string, v: Valeur) => {
    if (!ecritures.has(feuille)) ecritures.set(feuille, new Map());
    ecritures.get(feuille)!.set(adresse, v);
  };

  for (const b of blocs) {
    const ws = lu.Sheets[b.feuille];
    if (!ws) {
      rapport.introuvables.push(`${b.feuille} : feuille absente du modèle`);
      continue;
    }
    // Ligne de chaque code de poste dans la colonne des références.
    const lignes = new Map<string, number>();
    const plage = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
    const col = XLSX.utils.decode_col(b.colonneRef);
    for (let r = plage.s.r; r <= plage.e.r; r++) {
      const c = ws[XLSX.utils.encode_cell({ r, c: col })];
      if (c?.v != null) lignes.set(String(c.v).trim(), r);
    }
    for (const l of b.lignes) {
      const r = lignes.get(l.ref);
      if (r == null) {
        rapport.introuvables.push(`${b.feuille} : ${l.ref}`);
        continue;
      }
      for (const [colonne, valeur] of Object.entries(b.colonnes))
        ecrire(b.feuille, `${colonne}${r + 1}`, valeur(l.ref, p.n, p.n1));
    }
  }

  // Notes annexes : les montants saisis du modèle sont effacés (une ligne que
  // l'ERP ne calcule pas reste vide, à compléter, plutôt qu'aux chiffres d'une
  // autre année), puis chaque ligne calculée est placée sur sa ligne du modèle.
  // Les totaux du modèle sont des formules : ils se recalculent.
  const correspondances = p.correspondancesNotes ?? CORRESPONDANCES_NOTES_2025;
  for (const note of p.n.notes ?? []) {
    const feuille = `NOTE ${note.numero}`;
    const ws = lu.Sheets[feuille];
    const f = ws && lireFeuilleNote(ws);
    if (!f) {
      rapport.introuvables.push(`${feuille} : feuille ou colonnes « Année N / N-1 » absentes`);
      continue;
    }
    const cellule = (r: number, c: number) => XLSX.utils.encode_cell({ r, c });
    const formule = (r: number, c: number) => !!(ws[cellule(r, c)] as XLSX.CellObject)?.f;
    for (let r = f.debut; r <= f.fin; r++) {
      if (formule(r, f.colN)) continue;
      for (let c = f.colN; c <= f.derniereColonne; c++) {
        const x = ws[cellule(r, c)] as XLSX.CellObject | undefined;
        if (x?.t === "n" && !x.f) ecrire(feuille, cellule(r, c), null);
      }
    }
    const notesN1 = p.n1?.notes?.find((x) => x.numero === note.numero);
    for (const l of note.lignes) {
      const corr = correspondances[note.numero]?.find(
        (c) => libelleComparable(c.ligne) === libelleComparable(l.libelle),
      );
      const r = f.lignes.get(libelleComparable(corr?.modele ?? l.libelle));
      if (r == null) {
        if (l.niveau === "detail")
          rapport.introuvables.push(
            `${feuille} : « ${l.libelle} »${l.montant ? ` (${Math.round(l.montant)})` : ""}`,
          );
        continue;
      }
      if (formule(r, f.colN)) continue;
      const signe = corr?.signe ?? (l.deduite ? -1 : 1);
      const vN = Math.round(signe * l.montant);
      const ligneN1 = notesN1?.lignes.find((x) => x.libelle === l.libelle);
      const vN1 = p.n1 ? Math.round(signe * (ligneN1?.montant ?? 0)) : null;
      ecrire(feuille, cellule(r, f.colN), vN);
      ecrire(feuille, cellule(r, f.colN1), vN1);
      if (corr?.hypothese && (vN || vN1)) {
        const h = `${feuille} : ${corr.hypothese}.`;
        if (!rapport.hypotheses.includes(h)) rapport.hypotheses.push(h);
      }
    }
    rapport.notesRemplies.push(feuille);
  }

  // Notes 3 (tableaux de mouvements) : chaque ligne repérée par son libellé en
  // colonne A, chaque colonne calculée à sa colonne du modèle ; une cellule du
  // modèle en formule (totaux, J = D + F − H…) n'est pas écrite.
  const colonnesTableaux = p.colonnesTableaux ?? COLONNES_TABLEAUX_2025;
  for (const t of p.n.immobilisations ?? []) {
    const feuille = `NOTE ${t.numero}`;
    const ws = lu.Sheets[feuille];
    const colonnes = colonnesTableaux[t.numero];
    if (!ws || !colonnes) {
      rapport.introuvables.push(`${feuille} : feuille ou disposition absente du modèle`);
      continue;
    }
    const lignes = new Map<string, number>();
    const plage = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
    for (let r = plage.s.r; r <= plage.e.r; r++) {
      const v = ws[XLSX.utils.encode_cell({ r, c: 0 })]?.v;
      if (v == null) continue;
      const libelle = libelleComparable(String(v));
      if (libelle.startsWith("commentaire")) break;
      if (!lignes.has(libelle)) lignes.set(libelle, r + 1);
    }
    for (const l of t.lignes) {
      const r = lignes.get(libelleComparable(l.libelle));
      if (r == null) {
        rapport.introuvables.push(`${feuille} : « ${l.libelle} »`);
        continue;
      }
      for (const [cle, colonne] of Object.entries(colonnes)) {
        if ((ws[`${colonne}${r}`] as XLSX.CellObject | undefined)?.f) continue;
        ecrire(feuille, `${colonne}${r}`, l.valeurs[cle] ?? null);
      }
    }
    for (const h of t.hypotheses) {
      const texte = `${feuille} : ${h}.`;
      if (!rapport.hypotheses.includes(texte)) rapport.hypotheses.push(texte);
    }
    rapport.notesRemplies.push(feuille);
  }

  // En-têtes d'identification de toutes les feuilles.
  for (const nom of lu.SheetNames) {
    const ws = lu.Sheets[nom];
    for (const adresse of Object.keys(ws)) {
      if (adresse[0] === "!") continue;
      const f = (ws[adresse] as XLSX.CellObject).f?.replace(/^=/, "").trim().toUpperCase();
      if (f && f in NOMS_IDENTITE) ecrire(nom, adresse, NOMS_IDENTITE[f](p));
    }
  }

  for (const [feuille, cellules] of ecritures) {
    const chemin = chemins.get(feuille);
    const fichier = chemin && zip.file(chemin);
    if (!fichier) {
      rapport.introuvables.push(`${feuille} : feuille absente du fichier`);
      continue;
    }
    let xml = await fichier.async("string");
    for (const [adresse, v] of cellules) {
      const r = ecrireCellule(xml, adresse, v);
      if (r.ok) {
        xml = r.xml;
        rapport.cellules++;
      } else rapport.introuvables.push(`${feuille} : cellule ${adresse}`);
    }
    zip.file(chemin, xml);
  }

  const remplies = new Set([
    ...blocs.map((b) => b.feuille).filter((f) => lu.Sheets[f]),
    ...rapport.notesRemplies,
  ]);
  rapport.feuillesMisesAJour = [...remplies, ...FEUILLES_CALCULEES.filter((f) => lu.Sheets[f])];
  // Feuilles avec des montants saisis (hors formules) sous l'en-tête : à compléter.
  for (const nom of lu.SheetNames) {
    if (remplies.has(nom) || FEUILLES_CALCULEES.includes(nom)) continue;
    const ws = lu.Sheets[nom];
    const montants = Object.keys(ws).some((a) => {
      if (a[0] === "!") return false;
      const c = ws[a] as XLSX.CellObject;
      return c.t === "n" && !c.f && Number(c.v) !== 0 && XLSX.utils.decode_cell(a).r >= 8;
    });
    if (montants) rapport.feuillesAVerifier.push(nom);
  }

  await forcerRecalcul(zip);
  await ajouterFeuille(zip, NOM_FEUILLE_RAPPORT, feuilleXml(lignesRapport(p, rapport)));

  const fichier = await zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
  return { fichier, macros, rapport };
}

function lignesRapport(p: ParametresExport, r: RapportExport): string[][] {
  const fin = p.exercice.date_fin.slice(0, 10).split("-").reverse().join("/");
  return [
    ["États financiers générés par l'ERP FABS-CI", ""],
    ["Exercice clos le", fin],
    ...(p.informations ?? []),
    ["", ""],
    ["Feuilles mises à jour", r.feuillesMisesAJour.join(", ")],
    [
      "Colonne N-1",
      r.n1Absent
        ? "Aucune donnée pour l'exercice précédent : colonnes N-1 laissées vides."
        : "Remplie depuis l'exercice précédent.",
    ],
    [
      "En-têtes",
      "Dénomination, adresse, sigle, NCC, NTD, date de clôture et durée remplacés par leur valeur (liens externes du modèle).",
    ],
    [
      "Recalcul",
      "Formules recalculées à l'ouverture. Si Excel demande d'activer le contenu ou de mettre à jour les liaisons, choisir de ne pas mettre à jour les liaisons externes.",
    ],
    ...(r.notesRemplies.length
      ? [
          [
            "Notes annexes",
            `${r.notesRemplies.join(", ")} : remplies depuis la comptabilité. Dans ces notes, une ligne vide n'est pas calculée par l'ERP et reste à compléter ; les colonnes d'échéances et les commentaires aussi.`,
          ],
        ]
      : []),
    ...(r.hypotheses.length
      ? [
          ["", ""],
          ["HYPOTHÈSES À VÉRIFIER", "Montants placés selon une hypothèse :"],
          ...r.hypotheses.map((h) => ["", h]),
        ]
      : []),
    ["", ""],
    [
      "À COMPLÉTER",
      "Les feuilles suivantes contiennent encore les montants du modèle et ne sont pas mises à jour par l'ERP :",
    ],
    ...r.feuillesAVerifier.map((f) => ["", f]),
    ...(r.introuvables.length
      ? [
          ["", ""],
          ["Postes non trouvés dans le modèle", r.introuvables.join(", ")],
        ]
      : []),
  ];
}
