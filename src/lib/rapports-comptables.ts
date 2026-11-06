/**
 * Rapports comptables : ventilation produits / charges, ratios et comparatifs,
 * calculés uniquement à partir de la balance (écritures comptables validées).
 * Fonctions pures pour être testées sans base.
 */
import type { BalanceRow } from "@/lib/compta-api";

export type Nature = "produit" | "charge";

/** SYSCOHADA : classe 7 produits, classe 6 charges ; classe 8 HAO (pairs = produits, impairs = charges). */
export function natureCompte(compte: string): Nature | null {
  const c = compte.trim();
  if (c.startsWith("7")) return "produit";
  if (c.startsWith("6")) return "charge";
  if (c.startsWith("8") && c.length >= 2) {
    const d = Number(c[1]);
    if (!Number.isFinite(d) || d === 0) return null;
    return d % 2 === 0 ? "produit" : "charge";
  }
  return null;
}

/** Montant d'un compte dans son sens naturel (produit = crédit − débit, charge = débit − crédit). */
export function montantNaturel(row: Pick<BalanceRow, "compte" | "debit" | "credit">): number {
  const n = natureCompte(row.compte);
  if (n === "produit") return row.credit - row.debit;
  if (n === "charge") return row.debit - row.credit;
  return 0;
}

export const RUBRIQUES: { code: string; libelle: string; nature: Nature }[] = [
  { code: "70", libelle: "Ventes", nature: "produit" },
  { code: "71", libelle: "Subventions d'exploitation", nature: "produit" },
  { code: "72", libelle: "Production immobilisée", nature: "produit" },
  { code: "73", libelle: "Variation des stocks produits", nature: "produit" },
  { code: "75", libelle: "Autres produits", nature: "produit" },
  { code: "77", libelle: "Produits financiers", nature: "produit" },
  { code: "78", libelle: "Transferts de charges", nature: "produit" },
  { code: "79", libelle: "Reprises de provisions", nature: "produit" },
  { code: "60", libelle: "Achats et variations de stocks", nature: "charge" },
  { code: "61", libelle: "Transports", nature: "charge" },
  { code: "62", libelle: "Services extérieurs A", nature: "charge" },
  { code: "63", libelle: "Services extérieurs B", nature: "charge" },
  { code: "64", libelle: "Impôts et taxes", nature: "charge" },
  { code: "65", libelle: "Autres charges", nature: "charge" },
  { code: "66", libelle: "Charges de personnel", nature: "charge" },
  { code: "67", libelle: "Frais financiers", nature: "charge" },
  { code: "68", libelle: "Dotations aux amortissements", nature: "charge" },
  { code: "69", libelle: "Dotations aux provisions", nature: "charge" },
];

export type LigneRubrique = { code: string; libelle: string; nature: Nature; montant: number };

export type Synthese = {
  produits: number;
  charges: number;
  resultat: number;
  chiffreAffaires: number;
  achats: number;
  personnel: number;
  margeBrute: number;
  /** Ratios en pourcentage du chiffre d'affaires ; null si CA nul. */
  tauxMargeBrute: number | null;
  tauxMargeNette: number | null;
  poidsPersonnel: number | null;
  poidsAchats: number | null;
  rubriques: LigneRubrique[];
};

function pct(n: number, d: number): number | null {
  return d === 0 ? null : (n / d) * 100;
}

export function syntheseBalance(rows: Pick<BalanceRow, "compte" | "debit" | "credit">[]): Synthese {
  const parRubrique = new Map<string, number>();
  let produits = 0;
  let charges = 0;
  for (const r of rows) {
    const n = natureCompte(r.compte);
    if (!n) continue;
    const m = montantNaturel(r);
    if (n === "produit") produits += m;
    else charges += m;
    const code = r.compte.trim().slice(0, 2);
    parRubrique.set(code, (parRubrique.get(code) ?? 0) + m);
  }
  const connus = new Set(RUBRIQUES.map((r) => r.code));
  const rubriques: LigneRubrique[] = RUBRIQUES.map((r) => ({ ...r, montant: parRubrique.get(r.code) ?? 0 }));
  // Classe 8 et rubriques non listées : regroupées en HAO / autres.
  let haoP = 0;
  let haoC = 0;
  for (const [code, m] of parRubrique) {
    if (connus.has(code)) continue;
    if (natureCompte(code) === "produit") haoP += m;
    else haoC += m;
  }
  if (haoP) rubriques.push({ code: "8P", libelle: "Produits HAO et autres", nature: "produit", montant: haoP });
  if (haoC) rubriques.push({ code: "8C", libelle: "Charges HAO et impôts sur le résultat", nature: "charge", montant: haoC });

  const chiffreAffaires = parRubrique.get("70") ?? 0;
  const achats = parRubrique.get("60") ?? 0;
  const personnel = parRubrique.get("66") ?? 0;
  const resultat = produits - charges;
  const margeBrute = chiffreAffaires - achats;
  return {
    produits,
    charges,
    resultat,
    chiffreAffaires,
    achats,
    personnel,
    margeBrute,
    tauxMargeBrute: pct(margeBrute, chiffreAffaires),
    tauxMargeNette: pct(resultat, chiffreAffaires),
    poidsPersonnel: pct(personnel, chiffreAffaires),
    poidsAchats: pct(achats, chiffreAffaires),
    rubriques,
  };
}

/** Variation en % entre deux valeurs ; null si la base est nulle. */
export function variation(actuel: number, precedent: number): number | null {
  if (precedent === 0) return null;
  return ((actuel - precedent) / Math.abs(precedent)) * 100;
}

/** Mois (AAAA-MM-JJ début/fin) couvrant une période, bornés aux dates fournies. */
export function moisDeLaPeriode(debut: string, fin: string): { cle: string; from: string; to: string }[] {
  const out: { cle: string; from: string; to: string }[] = [];
  let y = Number(debut.slice(0, 4));
  let m = Number(debut.slice(5, 7));
  const yf = Number(fin.slice(0, 4));
  const mf = Number(fin.slice(5, 7));
  while (y < yf || (y === yf && m <= mf)) {
    const mm = String(m).padStart(2, "0");
    const dernier = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const from = `${y}-${mm}-01`;
    const to = `${y}-${mm}-${String(dernier).padStart(2, "0")}`;
    out.push({ cle: `${y}-${mm}`, from: from < debut ? debut : from, to: to > fin ? fin : to });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    if (out.length > 36) break;
  }
  return out;
}

/** Décale une date AAAA-MM-JJ d'un an en arrière (29/02 → 28/02). */
export function anneePrecedente(date: string): string {
  const y = Number(date.slice(0, 4)) - 1;
  let md = date.slice(5);
  if (md === "02-29") md = "02-28";
  return `${y}-${md}`;
}

const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
export function libelleMois(cle: string): string {
  return `${MOIS[Number(cle.slice(5, 7)) - 1]} ${cle.slice(0, 4)}`;
}
