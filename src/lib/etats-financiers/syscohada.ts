// États financiers SYSCOHADA révisé, système normal : bilan et compte de résultat
// calculés depuis la balance, avec les références de la liasse DGI (AD, AE… TA, RA…).
//
// Sources : balance cumulée à la date de clôture pour les classes 1 à 5, balance de
// la période pour les classes 6 à 8. Un résultat d'exercices antérieurs resté dans
// les classes 6 à 8 (exercice non clôturé en écritures) va au report à nouveau.

import type { BalanceRow } from "@/lib/compta-api";

export type Sens = "D" | "C";
type Regle = { poste: string; prefixes: string[]; sens?: Sens };

export type Ligne = {
  ref: string;
  libelle: string;
  note?: string;
  /** Sous-total calculé : liste des postes additionnés. */
  somme?: string[];
};

// ─── Actif ────────────────────────────────────────────────────────────────────
export const LIGNES_ACTIF: Ligne[] = [
  {
    ref: "AD",
    libelle: "IMMOBILISATIONS INCORPORELLES",
    note: "3",
    somme: ["AE", "AF", "AG", "AH"],
  },
  { ref: "AE", libelle: "Frais de développement et de prospection" },
  { ref: "AF", libelle: "Brevets, licences, logiciels et droits similaires" },
  { ref: "AG", libelle: "Fonds commercial et droit au bail" },
  { ref: "AH", libelle: "Autres immobilisations incorporelles" },
  {
    ref: "AI",
    libelle: "IMMOBILISATIONS CORPORELLES",
    note: "3",
    somme: ["AJ", "AK", "AL", "AM", "AN"],
  },
  { ref: "AJ", libelle: "Terrains" },
  { ref: "AK", libelle: "Bâtiments" },
  { ref: "AL", libelle: "Aménagements, agencements et installations" },
  { ref: "AM", libelle: "Matériel, mobilier et actifs biologiques" },
  { ref: "AN", libelle: "Matériel de transport" },
  { ref: "AP", libelle: "AVANCES ET ACOMPTES VERSÉS SUR IMMOBILISATIONS", note: "3" },
  { ref: "AQ", libelle: "IMMOBILISATIONS FINANCIÈRES", note: "4", somme: ["AR", "AS"] },
  { ref: "AR", libelle: "Titres de participation" },
  { ref: "AS", libelle: "Autres immobilisations financières" },
  { ref: "AZ", libelle: "TOTAL ACTIF IMMOBILISÉ", somme: ["AD", "AI", "AP", "AQ"] },
  { ref: "BA", libelle: "ACTIF CIRCULANT HAO", note: "5" },
  { ref: "BB", libelle: "STOCKS ET ENCOURS", note: "6" },
  { ref: "BG", libelle: "CRÉANCES ET EMPLOIS ASSIMILÉS", somme: ["BH", "BI", "BJ"] },
  { ref: "BH", libelle: "Fournisseurs avances versées", note: "17" },
  { ref: "BI", libelle: "Clients", note: "7" },
  { ref: "BJ", libelle: "Autres créances", note: "8" },
  { ref: "BK", libelle: "TOTAL ACTIF CIRCULANT", somme: ["BA", "BB", "BG"] },
  { ref: "BQ", libelle: "Titres de placement", note: "9" },
  { ref: "BR", libelle: "Valeurs à encaisser", note: "10" },
  { ref: "BS", libelle: "Banques, chèques postaux, caisse et assimilés", note: "11" },
  { ref: "BT", libelle: "TOTAL TRÉSORERIE-ACTIF", somme: ["BQ", "BR", "BS"] },
  { ref: "BU", libelle: "Écart de conversion-Actif", note: "12" },
  { ref: "BZ", libelle: "TOTAL GÉNÉRAL", somme: ["AZ", "BK", "BT", "BU"] },
];

// ─── Passif ───────────────────────────────────────────────────────────────────
export const LIGNES_PASSIF: Ligne[] = [
  { ref: "CA", libelle: "Capital", note: "13" },
  { ref: "CB", libelle: "Apporteurs capital non appelé (-)", note: "13" },
  { ref: "CD", libelle: "Primes liées au capital social", note: "14" },
  { ref: "CE", libelle: "Écarts de réévaluation", note: "3e" },
  { ref: "CF", libelle: "Réserves indisponibles", note: "14" },
  { ref: "CG", libelle: "Réserves libres", note: "14" },
  { ref: "CH", libelle: "Report à nouveau (+ ou -)", note: "14" },
  { ref: "CJ", libelle: "Résultat net de l'exercice (bénéfice + ou perte -)" },
  { ref: "CL", libelle: "Subventions d'investissement", note: "15" },
  { ref: "CM", libelle: "Provisions réglementées", note: "15" },
  {
    ref: "CP",
    libelle: "TOTAL CAPITAUX PROPRES ET RESSOURCES ASSIMILÉES",
    somme: ["CA", "CB", "CD", "CE", "CF", "CG", "CH", "CJ", "CL", "CM"],
  },
  { ref: "DA", libelle: "Emprunts et dettes financières diverses", note: "16" },
  { ref: "DB", libelle: "Dettes de location-acquisition", note: "16" },
  { ref: "DC", libelle: "Provisions pour risques et charges", note: "16" },
  {
    ref: "DD",
    libelle: "TOTAL DETTES FINANCIÈRES ET RESSOURCES ASSIMILÉES",
    somme: ["DA", "DB", "DC"],
  },
  { ref: "DF", libelle: "TOTAL RESSOURCES STABLES", somme: ["CP", "DD"] },
  { ref: "DH", libelle: "Dettes circulantes HAO", note: "5" },
  { ref: "DI", libelle: "Clients, avances reçues", note: "7" },
  { ref: "DJ", libelle: "Fournisseurs d'exploitation", note: "17" },
  { ref: "DK", libelle: "Dettes fiscales et sociales", note: "18" },
  { ref: "DM", libelle: "Autres dettes", note: "19" },
  { ref: "DN", libelle: "Provisions pour risques et charges à court terme", note: "19" },
  { ref: "DP", libelle: "TOTAL PASSIF CIRCULANT", somme: ["DH", "DI", "DJ", "DK", "DM", "DN"] },
  { ref: "DQ", libelle: "Banques, crédits d'escompte", note: "20" },
  { ref: "DR", libelle: "Banques, établissements financiers et crédits de trésorerie", note: "20" },
  { ref: "DT", libelle: "TOTAL TRÉSORERIE-PASSIF", somme: ["DQ", "DR"] },
  { ref: "DV", libelle: "Écart de conversion-Passif", note: "12" },
  { ref: "DZ", libelle: "TOTAL GÉNÉRAL", somme: ["DF", "DP", "DT", "DV"] },
];

// ─── Compte de résultat ──────────────────────────────────────────────────────
// Produits en positif, charges en négatif, comme dans la liasse DGI.
const XC_DETAIL = ["TE", "TF", "TG", "TH", "TI", "RC", "RD", "RE", "RF", "RG", "RH", "RI", "RJ"];
export const LIGNES_RESULTAT: Ligne[] = [
  { ref: "TA", libelle: "Ventes de marchandises", note: "21" },
  { ref: "RA", libelle: "Achats de marchandises", note: "22" },
  { ref: "RB", libelle: "Variation de stocks de marchandises", note: "6" },
  { ref: "XA", libelle: "MARGE COMMERCIALE (Somme TA à RB)", somme: ["TA", "RA", "RB"] },
  { ref: "TB", libelle: "Ventes de produits fabriqués", note: "21" },
  { ref: "TC", libelle: "Travaux, services vendus", note: "21" },
  { ref: "TD", libelle: "Produits accessoires", note: "21" },
  { ref: "XB", libelle: "CHIFFRE D'AFFAIRES (A + B + C + D)", somme: ["TA", "TB", "TC", "TD"] },
  { ref: "TE", libelle: "Production stockée (ou déstockage)", note: "6" },
  { ref: "TF", libelle: "Production immobilisée", note: "21" },
  { ref: "TG", libelle: "Subventions d'exploitation", note: "21" },
  { ref: "TH", libelle: "Autres produits", note: "21" },
  { ref: "TI", libelle: "Transferts de charges d'exploitation", note: "12" },
  { ref: "RC", libelle: "Achats de matières premières et fournitures liées", note: "22" },
  {
    ref: "RD",
    libelle: "Variation de stocks de matières premières et fournitures liées",
    note: "6",
  },
  { ref: "RE", libelle: "Autres achats", note: "22" },
  { ref: "RF", libelle: "Variation de stocks d'autres approvisionnements", note: "6" },
  { ref: "RG", libelle: "Transports", note: "23" },
  { ref: "RH", libelle: "Services extérieurs", note: "24" },
  { ref: "RI", libelle: "Impôts et taxes", note: "25" },
  { ref: "RJ", libelle: "Autres charges", note: "26" },
  {
    ref: "XC",
    libelle: "VALEUR AJOUTÉE (XB + RA + RB) + (somme TE à RJ)",
    somme: ["XB", "RA", "RB", ...XC_DETAIL],
  },
  { ref: "RK", libelle: "Charges de personnel", note: "27" },
  { ref: "XD", libelle: "EXCÉDENT BRUT D'EXPLOITATION (XC + RK)", somme: ["XC", "RK"] },
  { ref: "TJ", libelle: "Reprises d'amortissements, provisions et dépréciations", note: "28" },
  {
    ref: "RL",
    libelle: "Dotations aux amortissements, aux provisions et dépréciations",
    note: "3C&28",
  },
  { ref: "XE", libelle: "RÉSULTAT D'EXPLOITATION (XD + TJ + RL)", somme: ["XD", "TJ", "RL"] },
  { ref: "TK", libelle: "Revenus financiers et assimilés", note: "29" },
  { ref: "TL", libelle: "Reprises de provisions et dépréciations financières", note: "28" },
  { ref: "TM", libelle: "Transferts de charges financières", note: "12" },
  { ref: "RM", libelle: "Frais financiers et charges assimilées", note: "29" },
  {
    ref: "RN",
    libelle: "Dotations aux provisions et aux dépréciations financières",
    note: "3C&28",
  },
  {
    ref: "XF",
    libelle: "RÉSULTAT FINANCIER (somme TK à RN)",
    somme: ["TK", "TL", "TM", "RM", "RN"],
  },
  { ref: "XG", libelle: "RÉSULTAT DES ACTIVITÉS ORDINAIRES (XE + XF)", somme: ["XE", "XF"] },
  { ref: "TN", libelle: "Produits des cessions d'immobilisations", note: "3D" },
  { ref: "TO", libelle: "Autres produits HAO", note: "30" },
  { ref: "RO", libelle: "Valeurs comptables des cessions d'immobilisations", note: "3D" },
  { ref: "RP", libelle: "Autres charges HAO", note: "30" },
  {
    ref: "XH",
    libelle: "RÉSULTAT HORS ACTIVITÉS ORDINAIRES (somme TN à RP)",
    somme: ["TN", "TO", "RO", "RP"],
  },
  { ref: "RQ", libelle: "Participation des travailleurs", note: "30" },
  { ref: "RS", libelle: "Impôts sur le résultat", note: "37" },
  { ref: "XI", libelle: "RÉSULTAT NET (XG + XH + RQ + RS)", somme: ["XG", "XH", "RQ", "RS"] },
];

// ─── Correspondance comptes → postes ─────────────────────────────────────────
// Le préfixe le plus long l'emporte. `sens` : le compte ne va à ce poste que si son
// solde est débiteur (D) ou créditeur (C) ; sert aux comptes de tiers et de trésorerie.
// Amortissements et dépréciations des immobilisations (28x, 29x) : voir posteAmortissement.
const REGLES_BILAN: Regle[] = [
  // Capitaux propres
  { poste: "CA", prefixes: ["101", "102", "103", "104"] },
  { poste: "CB", prefixes: ["109"] },
  { poste: "CD", prefixes: ["105"] },
  { poste: "CE", prefixes: ["106"] },
  { poste: "CF", prefixes: ["111", "112", "113"] },
  { poste: "CG", prefixes: ["118"] },
  { poste: "CH", prefixes: ["12"] },
  { poste: "CJ", prefixes: ["13"] },
  { poste: "CL", prefixes: ["14"] },
  { poste: "CM", prefixes: ["15"] },
  // Dettes financières
  { poste: "DA", prefixes: ["16", "181", "182", "183", "184"] },
  { poste: "DB", prefixes: ["17"] },
  { poste: "DC", prefixes: ["19"] },
  // Immobilisations (brut)
  { poste: "AE", prefixes: ["211", "2181", "2191"] },
  { poste: "AF", prefixes: ["212", "213", "214", "2193"] },
  { poste: "AG", prefixes: ["215", "216"] },
  { poste: "AH", prefixes: ["217", "218", "219"] },
  { poste: "AJ", prefixes: ["22"] },
  { poste: "AK", prefixes: ["231", "232", "233", "237", "2391"] },
  { poste: "AL", prefixes: ["234", "235", "238", "2392", "2393"] },
  { poste: "AM", prefixes: ["24"] },
  { poste: "AN", prefixes: ["245", "2495"] },
  { poste: "AP", prefixes: ["25"] },
  { poste: "AR", prefixes: ["26"] },
  { poste: "AS", prefixes: ["27"] },
  // Stocks
  { poste: "BB", prefixes: ["3"] },
  // Tiers : le sens du solde décide entre actif et passif
  { poste: "BH", prefixes: ["409"], sens: "D" },
  { poste: "DJ", prefixes: ["409"], sens: "C" },
  { poste: "BI", prefixes: ["41"], sens: "D" },
  { poste: "DI", prefixes: ["41"], sens: "C" },
  { poste: "BH", prefixes: ["40"], sens: "D" },
  { poste: "DJ", prefixes: ["40"], sens: "C" },
  { poste: "BJ", prefixes: ["42", "43", "44"], sens: "D" },
  { poste: "DK", prefixes: ["42", "43", "44"], sens: "C" },
  { poste: "BJ", prefixes: ["185", "45", "46", "47"], sens: "D" },
  { poste: "DM", prefixes: ["185", "45", "46", "47"], sens: "C" },
  { poste: "BU", prefixes: ["478"] },
  { poste: "DV", prefixes: ["479"] },
  { poste: "BA", prefixes: ["48"], sens: "D" },
  { poste: "DH", prefixes: ["48"], sens: "C" },
  { poste: "DN", prefixes: ["499"] },
  // Trésorerie
  { poste: "BQ", prefixes: ["50"] },
  { poste: "BR", prefixes: ["51"] },
  { poste: "BS", prefixes: ["52", "53", "54", "55", "57", "58"], sens: "D" },
  { poste: "DR", prefixes: ["52", "53", "54", "55", "57", "58"], sens: "C" },
  { poste: "DQ", prefixes: ["564", "565"] },
  { poste: "DR", prefixes: ["56"] },
];

const REGLES_RESULTAT: Regle[] = [
  { poste: "TA", prefixes: ["701"] },
  { poste: "TB", prefixes: ["702", "703", "704"] },
  { poste: "TC", prefixes: ["705", "706"] },
  { poste: "TD", prefixes: ["707", "708", "709"] },
  { poste: "TE", prefixes: ["73"] },
  { poste: "TF", prefixes: ["72"] },
  { poste: "TG", prefixes: ["71"] },
  { poste: "TH", prefixes: ["75"] },
  { poste: "TI", prefixes: ["781"] },
  { poste: "TM", prefixes: ["787"] },
  { poste: "TK", prefixes: ["77"] },
  { poste: "TJ", prefixes: ["791", "798", "799"] },
  { poste: "TL", prefixes: ["797"] },
  { poste: "RA", prefixes: ["601"] },
  { poste: "RB", prefixes: ["6031"] },
  { poste: "RC", prefixes: ["602"] },
  { poste: "RD", prefixes: ["6032"] },
  { poste: "RF", prefixes: ["6033"] },
  { poste: "RE", prefixes: ["604", "605", "608", "609"] },
  { poste: "RG", prefixes: ["61"] },
  { poste: "RH", prefixes: ["62", "63"] },
  { poste: "RI", prefixes: ["64"] },
  { poste: "RJ", prefixes: ["65"] },
  { poste: "RK", prefixes: ["66"] },
  { poste: "RM", prefixes: ["67"] },
  { poste: "RL", prefixes: ["681", "691"] },
  { poste: "RN", prefixes: ["687", "697"] },
  { poste: "RO", prefixes: ["81"] },
  { poste: "TN", prefixes: ["82"] },
  { poste: "RP", prefixes: ["83", "85"] },
  { poste: "TO", prefixes: ["84", "86", "88"] },
  { poste: "RQ", prefixes: ["87"] },
  { poste: "RS", prefixes: ["89"] },
];

function trouverPoste(regles: Regle[], compte: string, sens: Sens): string | null {
  let best: { poste: string; len: number } | null = null;
  for (const r of regles) {
    if (r.sens && r.sens !== sens) continue;
    for (const p of r.prefixes) {
      if (compte.startsWith(p) && (!best || p.length > best.len))
        best = { poste: r.poste, len: p.length };
    }
  }
  return best?.poste ?? null;
}

/** Poste d'actif dont un compte d'amortissement ou de dépréciation diminue le brut. */
function posteAmortissement(compte: string): string | null {
  // 28xx / 29xx → immobilisation 2xx correspondante (2845 → 245 → AN).
  if (/^2[89]/.test(compte)) return trouverPoste(REGLES_BILAN, "2" + compte.slice(2), "D");
  if (compte.startsWith("39")) return "BB";
  if (compte.startsWith("490")) return "BH";
  if (compte.startsWith("491")) return "BI";
  if (/^49[2-7]/.test(compte)) return "BJ";
  if (compte.startsWith("498")) return "BA";
  if (compte.startsWith("590")) return "BQ";
  if (compte.startsWith("59")) return "BS";
  return null;
}

/**
 * Immobilisation d'un compte de classe 2, selon les mêmes règles que le bilan :
 * poste d'actif (AE à AS) et nature (brut, amortissement 28x, dépréciation 29x).
 * Sert aux notes 3, qui recoupent ainsi l'actif immobilisé.
 */
export function posteImmobilisation(
  compte: string,
): { poste: string; nature: "brut" | "amort" | "deprec" } | null {
  const c = compte.trim();
  if (!c.startsWith("2")) return null;
  const nature = c.startsWith("28") ? "amort" : c.startsWith("29") ? "deprec" : "brut";
  const poste = nature === "brut" ? trouverPoste(REGLES_BILAN, c, "D") : posteAmortissement(c);
  return poste ? { poste, nature } : null;
}

// ─── Calcul ──────────────────────────────────────────────────────────────────
export type MontantActif = { brut: number; amort: number; net: number };

export type CompteNonClasse = { compte: string; libelle: string; solde: number };

export type EtatsFinanciers = {
  actif: Record<string, MontantActif>;
  passif: Record<string, number>;
  resultat: Record<string, number>;
  /** Résultat d'exercices antérieurs encore en classes 6 à 8, ajouté au report à nouveau. */
  resultatAnterieurNonAffecte: number;
  comptesNonClasses: CompteNonClasse[];
  controles: {
    /** Total actif net − total passif : 0 attendu. */
    ecartBilan: number;
    /** Résultat au bilan (CJ) − résultat net du compte de résultat (XI) : 0 attendu si 13 non encore mouvementé. */
    ecartResultat: number;
  };
};

const classe = (compte: string) => compte.charAt(0);
const estGestion = (compte: string) => ["6", "7", "8"].includes(classe(compte));

function sommer(lignes: Ligne[], valeurs: Record<string, number>) {
  // Les sous-totaux sont listés après leurs composants, sauf les totaux qui
  // reprennent des sous-totaux : on calcule dans l'ordre et on réitère si besoin.
  for (let passe = 0; passe < 3; passe++) {
    for (const l of lignes) {
      if (l.somme) valeurs[l.ref] = l.somme.reduce((s, r) => s + (valeurs[r] ?? 0), 0);
    }
  }
}

/**
 * @param cumul  balance cumulée jusqu'à la date de clôture (toutes écritures).
 * @param periode balance de l'exercice seul (date de début à date de clôture).
 */
export function calculerEtatsFinanciers(
  cumul: BalanceRow[],
  periode: BalanceRow[],
): EtatsFinanciers {
  const brut: Record<string, number> = {};
  const amort: Record<string, number> = {};
  const passif: Record<string, number> = {};
  const resultat: Record<string, number> = {};
  const nonClasses: CompteNonClasse[] = [];
  const add = (m: Record<string, number>, k: string, v: number) => (m[k] = (m[k] ?? 0) + v);

  let gestionCumul = 0;
  for (const r of cumul) {
    const compte = r.compte.trim();
    if (!r.solde) continue;
    if (estGestion(compte)) {
      gestionCumul += r.solde;
      continue;
    }
    if (!/^[1-5]/.test(compte)) {
      nonClasses.push({ compte, libelle: r.compte_libelle, solde: r.solde });
      continue;
    }
    const amortPoste = posteAmortissement(compte);
    if (amortPoste) {
      add(amort, amortPoste, -r.solde);
      continue;
    }
    const sens: Sens = r.solde > 0 ? "D" : "C";
    const poste = trouverPoste(REGLES_BILAN, compte, sens);
    if (!poste) nonClasses.push({ compte, libelle: r.compte_libelle, solde: r.solde });
    else if (poste.startsWith("A") || poste.startsWith("B")) add(brut, poste, r.solde);
    else add(passif, poste, -r.solde);
  }

  let gestionPeriode = 0;
  for (const r of periode) {
    const compte = r.compte.trim();
    if (!r.solde || !estGestion(compte)) continue;
    gestionPeriode += r.solde;
    const poste = trouverPoste(REGLES_RESULTAT, compte, r.solde > 0 ? "D" : "C");
    if (!poste) nonClasses.push({ compte, libelle: r.compte_libelle, solde: r.solde });
    else add(resultat, poste, -r.solde);
  }
  sommer(LIGNES_RESULTAT, resultat);

  // Résultat de l'exercice : compte 13 éventuel + gestion de la période.
  // Résultats antérieurs restés en classes 6 à 8 : report à nouveau.
  const resultatAnterieurNonAffecte = gestionPeriode - gestionCumul;
  add(passif, "CJ", -gestionPeriode);
  if (resultatAnterieurNonAffecte) add(passif, "CH", resultatAnterieurNonAffecte);

  const actif: Record<string, MontantActif> = {};
  const brutT = { ...brut };
  const amortT = { ...amort };
  sommer(LIGNES_ACTIF, brutT);
  sommer(LIGNES_ACTIF, amortT);
  for (const l of LIGNES_ACTIF) {
    const b = brutT[l.ref] ?? 0;
    const a = amortT[l.ref] ?? 0;
    actif[l.ref] = { brut: b, amort: a, net: b - a };
  }
  sommer(LIGNES_PASSIF, passif);

  const arrondi = (n: number) => Math.round(n * 100) / 100 || 0; // || 0 : pas de -0
  return {
    actif,
    passif,
    resultat,
    resultatAnterieurNonAffecte: arrondi(resultatAnterieurNonAffecte),
    comptesNonClasses: nonClasses,
    controles: {
      ecartBilan: arrondi(actif.BZ.net - (passif.DZ ?? 0)),
      ecartResultat: arrondi((passif.CJ ?? 0) - (resultat.XI ?? 0)),
    },
  };
}
