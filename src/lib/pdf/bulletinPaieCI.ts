import { COMPANY } from "@/lib/company";
// ---------------------------------------------------------------------------
// Bulletin de paie — reproduction fidèle du modèle EDITIONS FABS (août 2022)
// A4 portrait, UNE seule page. Mise en page identique au modèle :
//  - cadres employeur / salarié (2 cadres) en haut, titre sous le cadre employeur
//  - tableau 7 colonnes (N° · DESIGNATION · NBRE. · BASE · TAUX · GAINS · RETENUES)
//    avec sous-totaux "SALAIRE BRUT IMPOSABLE" et "TOTAL RETENUES FISCALES
//    & SOCIALES", puis rubriques non imposables (indemnités, CMU, arrondi)
//  - pied à 3 cellules (indemnités non impo. · autres retenues · coût salarial)
//  - NET A PAYER, CUMULS ANNUELS, signature, date et mode de paiement
// Interface publique inchangée (types + generateBulletinPaieCIPDF).
// ---------------------------------------------------------------------------
import type jsPDFType from "jspdf";

export type BulletinLigne = {
  code?: string;
  libelle: string;
  nbre?: number | null;
  base?: number | null;
  taux?: number | null;
  gain?: number | null;
  retenue?: number | null;
  /** true = imposable (avant sous-total brut imposable), false = non-imposable
   *  (indemnités non-impo / autres retenues, après les sous-totaux). Défaut : true. */
  imposable?: boolean;
};

export type BulletinEntreprise = {
  raisonSociale: string;
  adresse?: string;
  telephone?: string;
  email?: string;
  rccm?: string;
  numContribuable?: string;
  cnpsEmployeur?: string;
};

export type BulletinSalarie = {
  matricule: string;
  nomComplet: string;
  fonction?: string;
  departement?: string;
  service?: string;
  categorie?: string;
  adresse?: string;
  parts?: number | string;
  dateEmbauche?: string;
  anciennete?: string;
  numCnps?: string;
};

export type BulletinPeriode = {
  periode: string; // libellé "Août 2022"
  mois?: string;
  annee?: string | number;
  du?: string;
  au?: string;
  dateEdition?: string;
};

export type BulletinTotaux = {
  totalGains: number;
  totalRetenues: number;
  salaireBrut: number;
  salaireImposable: number;
  netAPayer: number;
  totalIndemnitesNonImpo?: number;
  totalAutresRetenues?: number;
  coutSalarial?: number;
  coutEmployeur?: number;
};

export type BulletinPaiement = {
  date?: string;
  mode?: string;
};

export type BulletinCumulsAnnuels = {
  cr?: number;
  cn?: number;
  crn?: number;
  its?: number;
  igr?: number;
  brutImposable?: number;
  jrsTravailles?: number;
};

export type BulletinCIData = {
  reference: string;
  entreprise: BulletinEntreprise;
  salarie: BulletinSalarie;
  periode: BulletinPeriode;
  /** Rubriques du bulletin. À défaut, `gains`/`retenues` sont utilisés
   *  (compat, tous marqués imposables). Ajouter de nouvelles rubriques
   *  se fait simplement en poussant des éléments dans ce tableau. */
  lignes?: BulletinLigne[];
  gains?: Array<Omit<BulletinLigne, "gain" | "retenue"> & { montant: number }>;
  retenues?: Array<Omit<BulletinLigne, "gain" | "retenue"> & { montant: number }>;
  patronales?: BulletinLigne[];
  totaux: BulletinTotaux;
  paiement?: BulletinPaiement;
  cumuls?: BulletinCumulsAnnuels;
  observations?: string;
  /** Champs libres RH/Compta (références internes, notes, etc.). Rendus
   *  automatiquement dans un bloc dédié avant les signatures. */
  champsPersonnalises?: Array<{ label: string; valeur: string }>;
};

/** Options de mise en page A4 pour garantir un rendu homogène entre
 *  navigateurs / systèmes (marges physiques et taille de police de base). */
export type BulletinPdfOptions = {
  /** Marge en mm appliquée aux 4 côtés (par défaut 10 mm). */
  margin?: number;
  /** Taille de police du corps en pt (par défaut 8.5). Les tableaux et
   *  textes secondaires sont ajustés proportionnellement. */
  baseFontSize?: number;
};

// Entreprise par défaut — surchargée par l'appelant. Les valeurs ci-dessous
// sont celles du bulletin modèle ; à renseigner dans les paramètres entreprise.
export const ENTREPRISE_FABS: BulletinEntreprise = {
  raisonSociale: COMPANY.nom,
  adresse: "BP 693 BINGERVILLE",
  telephone: "+225 0759737123",
  cnpsEmployeur: "366145",
};

// ---- Formats --------------------------------------------------------------
// jsPDF/Helvetica ne contient pas U+202F/U+00A0 : espace ASCII uniquement.
const int = (n: number): string => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const money = (n?: number | null): string =>
  n == null || Number.isNaN(Number(n)) || Math.round(Number(n)) === 0 ? "" : int(Number(n));
const moneyAlways = (n?: number | null): string =>
  n == null || Number.isNaN(Number(n)) ? "0" : int(Number(n));
const taux = (t?: number | null): string =>
  t == null || Number.isNaN(Number(t)) || Number(t) === 0 ? "" : Number(t).toFixed(2).replace(".", ",");
const nbre = (n?: number | null): string =>
  n == null || Number.isNaN(Number(n)) || Number(n) === 0 ? "" : String(Math.round(Number(n) * 100) / 100).replace(".", ",");

const MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

function parseDate(s?: string): { d: number; m: number; y: number } | null {
  if (!s) return null;
  let r = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (r) return { y: +r[1], m: +r[2], d: +r[3] };
  r = /^(\d{2})\/(\d{2})\/(\d{2,4})/.exec(s);
  if (r) return { d: +r[1], m: +r[2], y: r[3].length === 2 ? 2000 + +r[3] : +r[3] };
  return null;
}

const capitaliser = (s?: string | null): string => {
  const t = (s ?? "").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "";
};
const dateLongue = (s?: string): { jour: string; mois: string; annee: string } => {
  const d = parseDate(s) ?? (() => {
    const n = new Date();
    return { d: n.getDate(), m: n.getMonth() + 1, y: n.getFullYear() };
  })();
  return { jour: String(d.d), mois: MOIS[d.m - 1], annee: String(d.y) };
};
/** « 1er octobre 2026 », « 20 octobre 2026 » : mois en lettres minuscules. */
export const dateEnLettres = (s?: string): string => {
  const d = parseDate(s);
  if (!d) return s ?? "";
  return `${d.d === 1 ? "1er" : d.d} ${MOIS[d.m - 1].toLowerCase()} ${d.y}`;
};
const partsFmt = (p?: number | string): string => {
  if (p == null || p === "") return "";
  const n = Number(p);
  return Number.isNaN(n) ? String(p) : n.toFixed(1).replace(".", ",");
};

// ---- Construction des lignes (ordre du modèle) ----------------------------
function normaliseLignes(data: BulletinCIData): BulletinLigne[] {
  if (data.lignes && data.lignes.length) return data.lignes;
  const g = (data.gains ?? []).map<BulletinLigne>((l) => ({
    code: l.code, libelle: l.libelle, nbre: l.nbre, base: l.base, taux: l.taux,
    gain: l.montant, imposable: l.imposable ?? true,
  }));
  const r = (data.retenues ?? []).map<BulletinLigne>((l) => ({
    code: l.code, libelle: l.libelle, nbre: l.nbre, base: l.base, taux: l.taux,
    retenue: l.montant, imposable: l.imposable ?? true,
  }));
  return [...g, ...r];
}

type Row =
  | { kind: "line"; l: BulletinLigne }
  | { kind: "sub"; label: string; col: "gain" | "retenue"; amount: number }
  | { kind: "gap" };

function buildRows(data: BulletinCIData): Row[] {
  const lignes = normaliseLignes(data);
  const imposables = lignes.filter((l) => l.imposable !== false);
  // Une ligne est une retenue dès qu'elle porte un champ `retenue` (même à 0,
  // ex. ITS annulé par la réduction pour charges de famille) et aucun gain.
  const isRet = (l: BulletinLigne) => l.retenue != null && !(Number(l.gain) > 0);
  const gainsImp = imposables.filter((l) => !isRet(l));
  const retImp = imposables.filter(isRet);
  const nonImpo = lignes.filter((l) => l.imposable === false);

  const brutImposable =
    data.totaux.salaireImposable ?? gainsImp.reduce((s, l) => s + (Number(l.gain) || 0), 0);
  const totalRetFisc = retImp.reduce((s, l) => s + (Number(l.retenue) || 0), 0);

  const rows: Row[] = [];
  gainsImp.forEach((l) => rows.push({ kind: "line", l }));
  rows.push({ kind: "gap" });
  rows.push({ kind: "sub", label: "SALAIRE BRUT IMPOSABLE", col: "gain", amount: brutImposable });
  rows.push({ kind: "gap" });
  retImp.forEach((l) => rows.push({ kind: "line", l }));
  rows.push({ kind: "gap" });
  rows.push({ kind: "sub", label: "TOTAL RETENUES FISCALES & SOCIALES", col: "retenue", amount: totalRetFisc });
  rows.push({ kind: "gap" });
  nonImpo.forEach((l) => rows.push({ kind: "line", l }));
  return rows;
}

// ---- Génération -----------------------------------------------------------
export async function generateBulletinPaieCIPDF(
  data: BulletinCIData,
  opts: BulletinPdfOptions = {},
): Promise<Blob> {
  const { default: jsPDF } = (await import("jspdf")) as unknown as { default: typeof jsPDFType };
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const W = doc.internal.pageSize.getWidth();
  const m = Math.max(6, Math.min(20, opts.margin ?? 12));
  const fs = Math.max(7.5, Math.min(11, opts.baseFontSize ?? 9));
  const X0 = m;
  const X1 = W - m;
  const TW = X1 - X0;
  const GREY = 110;

  const ent = data.entreprise;
  const sal = data.salarie;
  const per = data.periode;
  const tot = data.totaux;

  type Style = "normal" | "bold" | "italic" | "bolditalic";
  const text = (
    s: string, x: number, y: number,
    o: { size?: number; style?: Style; font?: "helvetica" | "times"; align?: "left" | "right" | "center" } = {},
  ) => {
    doc.setFont(o.font ?? "helvetica", o.style ?? "normal");
    doc.setFontSize(o.size ?? fs);
    doc.setTextColor(0, 0, 0);
    doc.text(s, x, y, { align: o.align ?? "left" });
  };
  /** Écrit un libellé sans jamais dépasser maxW : réduit la police (jusqu'à −2 pt),
   *  puis passe à la ligne si besoin. */
  const fitText = (
    s: string, x: number, y: number, maxW: number,
    o: { size?: number; style?: Style; align?: "left" | "center" } = {},
  ) => {
    const base = o.size ?? fs;
    let size = base;
    doc.setFont("helvetica", o.style ?? "normal");
    doc.setFontSize(size);
    while (doc.getTextWidth(s) > maxW && size > base - 2) {
      size -= 0.25;
      doc.setFontSize(size);
    }
    if (doc.getTextWidth(s) <= maxW) return text(s, x, y, { ...o, size });
    const lines = (doc.splitTextToSize(s, maxW) as string[]).slice(0, 2);
    const lh = size * 0.3528 * 1.05;
    lines.forEach((ln, i) => text(ln, x, y - lh / 2 + i * lh, { ...o, size }));
  };
  const box = (x: number, y: number, w: number, h: number) => {
    doc.setDrawColor(GREY);
    doc.setLineWidth(0.25);
    doc.rect(x, y, w, h);
  };
  const hline = (x1: number, x2: number, y: number) => {
    doc.setDrawColor(GREY);
    doc.setLineWidth(0.25);
    doc.line(x1, y, x2, y);
  };
  const vline = (x: number, y1: number, y2: number) => {
    doc.setDrawColor(GREY);
    doc.setLineWidth(0.25);
    doc.line(x, y1, x, y2);
  };

  // ===== En-tête : cadre employeur (gauche) + 2 cadres salarié (droite) =====
  const gap = 4;
  const leftW = TW / 2 - gap / 2;
  const rightX = X0 + leftW + gap;
  const rightW = X1 - rightX;
  const y0 = m;
  const h1 = 25;
  const h2 = 17;

  box(X0, y0, leftW, h1);
  text(ent.raisonSociale, X0 + 4, y0 + 8.5, { size: 13, style: "bold" });
  text(ent.adresse ?? "", X0 + 4, y0 + 15, { size: fs - 0.5 });
  if (ent.telephone) text(`Tél. ${ent.telephone}`, X0 + leftW - 4, y0 + 15, { size: fs - 0.5, align: "right" });
  if (ent.cnpsEmployeur) text(`CNPS Employeur: ${ent.cnpsEmployeur}`, X0 + 4, y0 + 20.5, { size: fs - 0.5 });

  box(rightX, y0, rightW, h1);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  const nameLines = (doc.splitTextToSize(sal.nomComplet, rightW - 8) as string[]).slice(0, 2);
  nameLines.forEach((ln, i) => text(ln, rightX + 4, y0 + 7 + i * 5, { size: 11.5, style: "bold" }));
  text(`Poste : ${sal.fonction ?? ""}`, rightX + 4, y0 + 17.5, { size: fs - 0.5 });
  text(`Catég. : ${sal.categorie ?? ""}`, rightX + rightW - 4, y0 + 17.5, { size: fs - 0.5, align: "right" });
  text(`Lieu de résidence : ${capitaliser(sal.adresse)}`, rightX + 4, y0 + 22.5, { size: fs - 0.5 });

  box(rightX, y0 + h1, rightW, h2);
  text(`Matricule : ${sal.matricule ?? ""}`, rightX + 4, y0 + h1 + 6.5, { size: fs - 0.5 });
  text(`Date d'embauche : ${dateEnLettres(sal.dateEmbauche)}`, rightX + rightW - 4, y0 + h1 + 6.5, { size: fs - 0.5, align: "right" });
  text(`N° CNPS : ${sal.numCnps ?? ""}`, rightX + 4, y0 + h1 + 13, { size: fs - 0.5 });
  text(`Parts : ${partsFmt(sal.parts)}`, rightX + rightW - 4, y0 + h1 + 13, { size: fs - 0.5, align: "right" });

  // Titre sous le cadre employeur
  text("*".repeat(25), X0 + 1, y0 + h1 + 9, { size: 12, style: "bold" });
  let titleSize = 23;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(titleSize);
  while (doc.getTextWidth("BULLETIN DE PAIE") > leftW && titleSize > 14) {
    titleSize -= 1;
    doc.setFontSize(titleSize);
  }
  text("BULLETIN DE PAIE", X0, y0 + h1 + 19, { size: titleSize, style: "bold" });
  const dl = dateLongue(per.dateEdition);
  text("Établi le :", X0, y0 + h1 + 25.5, { size: fs - 1 });
  text(`${dl.jour}   ${dl.mois}   ${dl.annee}`, X0 + 17, y0 + h1 + 25.5, { size: fs - 1, style: "bold" });
  text(`Période du ${dateEnLettres(per.du)} au ${dateEnLettres(per.au)}`, X0, y0 + h1 + 30.5, { size: fs - 1, style: "bold" });

  // ===== Tableau principal ================================================
  const tTop = y0 + h1 + h2 + 20;
  const headH = 9;
  const bodyH = 128;
  const footH = 8;
  const bodyTop = tTop + headH;
  const bodyBottom = bodyTop + bodyH;
  const footBottom = bodyBottom + footH;

  const rel = [12.8, 79.1, 14.0, 20.3, 14.3, 21.2, 24.2];
  const k = TW / rel.reduce((a, b) => a + b, 0);
  const cw = rel.map((r) => r * k);
  const cx: number[] = [X0];
  cw.forEach((w, i) => cx.push(cx[i] + w));

  box(X0, tTop, TW, headH + bodyH);
  hline(X0, X1, bodyTop);
  for (let i = 1; i < cx.length - 1; i++) vline(cx[i], tTop, bodyBottom);
  const heads = ["N°", "DESIGNATION", "NBRE.", "BASE", "TAUX", "GAINS", "RETENUES"];
  heads.forEach((h, i) => text(h, cx[i] + cw[i] / 2, tTop + headH / 2 + 1.4, { size: fs, style: "bold", align: "center" }));

  const rows = buildRows(data);
  const weights = rows.map((r) => (r.kind === "gap" ? 0.6 : 1));
  const totalW = weights.reduce((a, b) => a + b, 0);
  const rowH = Math.max(2.8, Math.min(4.9, (bodyH - 2) / totalW));
  const fsRow = rowH < 3.6 ? fs - 1.5 : fs;

  let y = bodyTop + 1.5;
  rows.forEach((r, idx) => {
    const h = rowH * weights[idx];
    if (r.kind === "line") {
      const l = r.l;
      const ty = y + rowH * 0.72;
      text(l.code ?? "", cx[0] + 1.5, ty, { size: fsRow });
      fitText(l.libelle, cx[1] + 1.5, ty, cw[1] - 3, { size: fsRow });
      text(nbre(l.nbre), cx[3] - 1.5, ty, { size: fsRow, align: "right" });
      text(money(l.base), cx[4] - 1.5, ty, { size: fsRow, align: "right" });
      text(taux(l.taux), cx[5] - 1.5, ty, { size: fsRow, align: "right" });
      text(money(l.gain), cx[6] - 1.5, ty, { size: fsRow, align: "right" });
      const ret = l.retenue != null && Number(l.retenue) === 0 && !(Number(l.gain) > 0) ? "0" : money(l.retenue);
      text(ret, cx[7] - 1.5, ty, { size: fsRow, align: "right" });
    } else if (r.kind === "sub") {
      const ty = y + rowH * 0.72;
      fitText(r.label, cx[1] + cw[1] / 2, ty, cw[1] - 3, { size: fsRow, align: "center" });
      const ci = r.col === "gain" ? 5 : 6;
      hline(cx[ci], cx[ci + 1], y - 0.3);
      hline(cx[ci], cx[ci + 1], y + rowH + 0.3);
      text(moneyAlways(r.amount), cx[ci + 1] - 1.5, ty, { size: fsRow, style: "bolditalic", align: "right" });
    }
    y += h;
  });

  // ===== Pied du tableau : 3 cellules =====================================
  const fr = [38.2, 33.7, 28.1];
  const fx = [X0, X0 + (TW * fr[0]) / 100, X0 + (TW * (fr[0] + fr[1])) / 100, X1];
  box(X0, bodyBottom, TW, footH);
  vline(fx[1], bodyBottom, footBottom);
  vline(fx[2], bodyBottom, footBottom);
  const fy = bodyBottom + footH / 2 + 1.3;
  const cout = tot.coutSalarial ?? tot.coutEmployeur ?? 0;
  const footLabel = (label: string, amount: string, x0: number, x1: number) => {
    doc.setFont("helvetica", "bolditalic");
    doc.setFontSize(fs - 1.5);
    const aw = doc.getTextWidth(amount);
    fitText(label, x0 + 1.5, fy, Math.max(5, x1 - x0 - 3.5 - aw - 3), { size: fs - 1.5, style: "italic" });
  };
  footLabel("TOTAL INDEMNITES NON IMPOSABLES :", moneyAlways(tot.totalIndemnitesNonImpo), fx[0], fx[1]);
  text(moneyAlways(tot.totalIndemnitesNonImpo), fx[1] - 2, fy, { size: fs - 1.5, style: "bolditalic", align: "right" });
  footLabel("TOTAL AUTRES RETENUES :", moneyAlways(tot.totalAutresRetenues), fx[1], fx[2]);
  text(moneyAlways(tot.totalAutresRetenues), fx[2] - 2, fy, { size: fs - 1.5, style: "bolditalic", align: "right" });
  footLabel("COÛT SALARIAL :", moneyAlways(cout), fx[2], X1);
  text(moneyAlways(cout), X1 - 2, fy, { size: fs - 1.5, style: "bolditalic", align: "right" });

  // ===== NET A PAYER =======================================================
  const ny = footBottom + 12;
  text("NET A PAYER :", X0 + TW * 0.217, ny, { size: 15, style: "bold", font: "times" });
  text(moneyAlways(tot.netAPayer), X0 + TW * 0.52, ny, { size: 15, style: "bold", font: "times" });

  // ===== CUMULS ANNUELS =====================================================
  const cTop = ny + 8;
  const rT = 7, rL = 7, rV = 8;
  box(X0, cTop, TW, rT + rL + rV);
  text("CUMULS ANNUELS", X0 + TW / 2, cTop + rT / 2 + 1.3, { size: fs, style: "bold", align: "center" });
  hline(X0, X1, cTop + rT);
  hline(X0, X1, cTop + rT + rL);
  const crel = [24, 23.4, 24, 24, 24, 39, 27.6];
  const ck = TW / crel.reduce((a, b) => a + b, 0);
  const ccx: number[] = [X0];
  crel.forEach((w, i) => ccx.push(ccx[i] + w * ck));
  for (let i = 1; i < ccx.length - 1; i++) vline(ccx[i], cTop + rT, cTop + rT + rL + rV);
  const cl = ["C.R", "C.N", "C.R.N", "I.T.S", "I.G.R", "BRUT IMPOSABLE", "JRS. TRAVAILLES"];
  const cu = data.cumuls ?? {};
  const cv = [cu.cr, cu.cn, cu.crn, cu.its, cu.igr, cu.brutImposable, cu.jrsTravailles];
  cl.forEach((lab, i) => {
    const cxm = (ccx[i] + ccx[i + 1]) / 2;
    text(lab, cxm, cTop + rT + rL / 2 + 1.2, { size: fs - 1.5, align: "center" });
    text(moneyAlways(cv[i]), cxm, cTop + rT + rL + rV / 2 + 1.3, { size: fs - 0.5, align: "center" });
  });

  // ===== Signature / paiement ==============================================
  const sy = cTop + rT + rL + rV + 7;
  text("Signature de l'employé(e)", X0, sy, { size: fs - 0.5 });
  const px = X0 + TW * 0.6;
  text("Salaire payé le :", px, sy, { size: fs - 0.5 });
  text(dateEnLettres(data.paiement?.date), px + 28, sy, { size: fs - 0.5, style: "bold" });
  text("Mode de paiement :", px - 2, sy + 6, { size: fs - 0.5 });
  text(data.paiement?.mode ?? "", px + 30, sy + 6, { size: fs - 0.5, style: "bold" });

  // ===== Notes facultatives + mention légale ===============================
  const extras: string[] = [];
  if (data.observations) extras.push(data.observations);
  if (data.champsPersonnalises?.length)
    extras.push(data.champsPersonnalises.map((c) => `${c.label} : ${c.valeur}`).join("  ·  "));
  if (extras.length) {
    const lines = doc.splitTextToSize(extras.join("  —  "), TW) as string[];
    doc.setFontSize(7);
    lines.slice(0, 2).forEach((ln, i) => text(ln, X0, sy + 15 + i * 3.2, { size: 7, style: "italic" }));
  }
  const legalY = doc.internal.pageSize.getHeight() - m + 4;
  text(
    "Pour vous aider à faire valoir vos droits, conservez ce bulletin de paie sans limitation de durée.",
    X0, Math.min(legalY, 292), { size: 7.5 },
  );

  return doc.output("blob");
}

export function bulletinFileName(ref: string, employeNom: string): string {
  const slug = employeNom
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase();
  const refSlug = ref.replace(/[^a-zA-Z0-9]+/g, "-");
  return `${refSlug}_${slug}.pdf`;
}