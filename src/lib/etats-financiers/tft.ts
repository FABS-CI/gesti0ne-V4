// Tableau des flux de trésorerie (TFT) SYSCOHADA révisé, références de la liasse DGI.
//
// Méthode : bilans d'ouverture et de clôture + mouvements de l'exercice sur les
// comptes d'immobilisations et de financement. Les postes sont choisis pour que
// la variation de trésorerie calculée (ZG) égale toujours l'écart entre trésorerie
// nette de clôture et d'ouverture ; un écart signale un cas non couvert (écart de
// réévaluation, écarts de conversion…).
//
// Signes : encaissement positif, décaissement négatif, comme dans la liasse.

import type { BalanceRow } from "@/lib/compta-api";
import type { EtatsFinanciers, Ligne } from "@/lib/etats-financiers/syscohada";

export const LIGNES_TFT: Ligne[] = [
  {
    ref: "ZA",
    libelle: "Trésorerie nette au 1er janvier (trésorerie actif N-1 − trésorerie passif N-1)",
  },
  { ref: "FA", libelle: "Capacité d'autofinancement globale (CAFG)" },
  { ref: "FB", libelle: "− Variation d'actif circulant HAO" },
  { ref: "FC", libelle: "− Variation des stocks" },
  { ref: "FD", libelle: "− Variation des créances" },
  { ref: "FE", libelle: "+ Variation du passif circulant" },
  {
    ref: "ZB",
    libelle: "Flux de trésorerie provenant des activités opérationnelles (somme FA à FE)",
    somme: ["FA", "FB", "FC", "FD", "FE"],
  },
  { ref: "FF", libelle: "− Décaissements liés aux acquisitions d'immobilisations incorporelles" },
  { ref: "FG", libelle: "− Décaissements liés aux acquisitions d'immobilisations corporelles" },
  { ref: "FH", libelle: "− Décaissements liés aux acquisitions d'immobilisations financières" },
  {
    ref: "FI",
    libelle: "+ Encaissements liés aux cessions d'immobilisations incorporelles et corporelles",
  },
  { ref: "FJ", libelle: "+ Encaissements liés aux cessions d'immobilisations financières" },
  {
    ref: "ZC",
    libelle: "Flux de trésorerie provenant des activités d'investissement (somme FF à FJ)",
    somme: ["FF", "FG", "FH", "FI", "FJ"],
  },
  { ref: "FK", libelle: "+ Augmentations de capital par apports nouveaux" },
  { ref: "FL", libelle: "+ Subventions d'investissement reçues" },
  { ref: "FM", libelle: "− Prélèvements sur le capital" },
  { ref: "FN", libelle: "− Dividendes versés" },
  {
    ref: "ZD",
    libelle: "Flux de trésorerie provenant des capitaux propres (somme FK à FN)",
    somme: ["FK", "FL", "FM", "FN"],
  },
  { ref: "FO", libelle: "+ Emprunts" },
  { ref: "FP", libelle: "+ Autres dettes financières diverses" },
  { ref: "FQ", libelle: "− Remboursements des emprunts et autres dettes financières" },
  {
    ref: "ZE",
    libelle: "Flux de trésorerie provenant des capitaux étrangers (somme FO à FQ)",
    somme: ["FO", "FP", "FQ"],
  },
  {
    ref: "ZF",
    libelle: "Flux de trésorerie provenant des activités de financement (D + E)",
    somme: ["ZD", "ZE"],
  },
  {
    ref: "ZG",
    libelle: "VARIATION DE LA TRÉSORERIE NETTE DE LA PÉRIODE (B + C + F)",
    somme: ["ZB", "ZC", "ZF"],
  },
  { ref: "ZH", libelle: "Trésorerie nette au 31 décembre (G + A)", somme: ["ZG", "ZA"] },
];

export type Tft = {
  valeurs: Record<string, number>;
  /** Trésorerie nette de clôture au bilan − ZH : 0 attendu. */
  ecartTresorerie: number;
};

// Emprunts au sens de la liasse (renvoi 2) ; les autres comptes 16, 17 et 18 sont
// des « autres dettes financières » (renvoi 3).
const EMPRUNTS = ["161", "162", "1661", "1662"];

/**
 * @param ouverture états calculés sur la balance cumulée à la veille de l'exercice.
 * @param cloture   états de l'exercice.
 * @param periode   balance de l'exercice (mouvements débit / crédit).
 */
export function calculerTft(
  ouverture: EtatsFinanciers,
  cloture: EtatsFinanciers,
  periode: BalanceRow[],
): Tft {
  const commence = (compte: string, prefixes: string[]) =>
    prefixes.some((p) => compte.startsWith(p));
  const mouvement = (prefixes: string[], exclus: string[] = []) => {
    let debit = 0;
    let credit = 0;
    let solde = 0;
    for (const r of periode) {
      const c = r.compte.trim();
      if (!commence(c, prefixes) || commence(c, exclus)) continue;
      debit += r.debit;
      credit += r.credit;
      solde += r.solde;
    }
    return { debit, credit, solde };
  };
  const brut = (ef: EtatsFinanciers, ref: string) => ef.actif[ref]?.brut ?? 0;
  const passif = (ef: EtatsFinanciers, ref: string) => ef.passif[ref] ?? 0;
  const varBrut = (ref: string) => brut(cloture, ref) - brut(ouverture, ref);
  const varPassif = (...refs: string[]) =>
    refs.reduce((s, r) => s + passif(cloture, r) - passif(ouverture, r), 0);
  const tresorerie = (ef: EtatsFinanciers) => ef.actif.BT.net - passif(ef, "DT");

  const xi = cloture.resultat.XI ?? 0;
  // CAFG = résultat net + dotations − reprises + valeur comptable des cessions − prix de cession.
  const dotations = mouvement(["68", "69", "85"]).solde;
  const reprises = -mouvement(["79", "86"]).solde;
  const vncCessions = mouvement(["81"]).solde;
  const prixCessions = -mouvement(["82"]).solde;
  const prixCessionsFinancieres = -mouvement(["826"]).solde;

  const v: Record<string, number> = {
    ZA: tresorerie(ouverture),
    FA: xi + dotations - reprises + vncCessions - prixCessions,
    // Actif circulant au brut : les dépréciations sont déjà neutralisées dans la CAFG.
    FB: -varBrut("BA"),
    FC: -varBrut("BB"),
    FD: -varBrut("BG"),
    // Passif circulant hors dettes HAO (investissement) et provisions à court terme (CAFG).
    FE: varPassif("DI", "DJ", "DK", "DM"),
    FF: -mouvement(["21"]).debit,
    // Dettes sur acquisitions (HAO) : une immobilisation non encore payée n'est pas décaissée.
    FG: -mouvement(["22", "23", "24", "25"]).debit + varPassif("DH"),
    FH: -mouvement(["26", "27"]).debit,
    FI: prixCessions - prixCessionsFinancieres,
    // Prêts et dépôts remboursés (crédit 27) + cessions de titres.
    FJ: prixCessionsFinancieres + mouvement(["27"]).credit,
    FK: varPassif("CA", "CB", "CD"),
    FL: mouvement(["14"]).credit,
    FM: 0,
    // Dividendes : ce que réserves, report à nouveau et résultat n'ont pas conservé.
    FN: varPassif("CF", "CG", "CH", "CJ") - xi,
    FO: mouvement(EMPRUNTS).credit,
    FP: mouvement(["16", "17", "18"], EMPRUNTS).credit,
    FQ: -mouvement(["16", "17", "18"]).debit,
  };
  for (const l of LIGNES_TFT) if (l.somme) v[l.ref] = l.somme.reduce((s, r) => s + (v[r] ?? 0), 0);

  return {
    valeurs: v,
    ecartTresorerie: Math.round((tresorerie(cloture) - v.ZH) * 100) / 100 || 0,
  };
}
