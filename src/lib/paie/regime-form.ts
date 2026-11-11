// Champs éditables des régimes de paie (paie_regimes.parametres), seule source du calcul.
export type Bareme = Array<[number | null, number]>;
export type RegimeJson = Record<string, unknown>;

export type ChampRegime = {
  cle: string;
  libelle: string;
  unite: "%" | "FCFA" | "ans" | "jours";
  groupe: "Cotisations salarié" | "Cotisations employeur" | "Impôts" | "Primes et arrondi";
  regimes?: Array<"REGIME_2024" | "REGIME_2022">;
};

export const CHAMPS_REGIME: ChampRegime[] = [
  { cle: "cr_taux", libelle: "CNPS retraite salarié", unite: "%", groupe: "Cotisations salarié" },
  { cle: "cr_plafond", libelle: "Plafond retraite", unite: "FCFA", groupe: "Cotisations salarié" },
  { cle: "cmu_salarie", libelle: "CMU salarié", unite: "FCFA", groupe: "Cotisations salarié" },
  { cle: "retraite_pat_taux", libelle: "CNPS retraite employeur", unite: "%", groupe: "Cotisations employeur" },
  { cle: "retraite_pat_plafond", libelle: "Plafond retraite employeur", unite: "FCFA", groupe: "Cotisations employeur" },
  { cle: "pf_taux", libelle: "Prestations familiales", unite: "%", groupe: "Cotisations employeur" },
  { cle: "maternite_taux", libelle: "Assurance maternité", unite: "%", groupe: "Cotisations employeur" },
  { cle: "at_taux", libelle: "Accident du travail", unite: "%", groupe: "Cotisations employeur" },
  { cle: "plafond_prestations", libelle: "Plafond prestations", unite: "FCFA", groupe: "Cotisations employeur" },
  { cle: "cmu_patronal", libelle: "CMU employeur", unite: "FCFA", groupe: "Cotisations employeur" },
  { cle: "fdfp_taux", libelle: "FDFP", unite: "%", groupe: "Cotisations employeur" },
  { cle: "ricf_par_demi_part", libelle: "Réduction par demi-part", unite: "FCFA", groupe: "Impôts", regimes: ["REGIME_2024"] },
  { cle: "its_taux_forfait", libelle: "ITS forfaitaire", unite: "%", groupe: "Impôts", regimes: ["REGIME_2022"] },
  { cle: "cn_abattement", libelle: "Abattement CN", unite: "%", groupe: "Impôts", regimes: ["REGIME_2022"] },
  { cle: "transport_plafond", libelle: "Transport non imposable max", unite: "FCFA", groupe: "Primes et arrondi" },
  { cle: "anciennete_taux_par_an", libelle: "Ancienneté par an", unite: "%", groupe: "Primes et arrondi" },
  { cle: "anciennete_plafond", libelle: "Ancienneté maximum", unite: "%", groupe: "Primes et arrondi" },
  { cle: "jours_mois", libelle: "Jours par mois", unite: "jours", groupe: "Primes et arrondi" },
  { cle: "arrondi_unite", libelle: "Arrondi du net", unite: "FCFA", groupe: "Primes et arrondi" },
];

export const DEFAUTS_ANCIENNETE: Record<string, number> = {
  anciennete_taux_par_an: 1,
  anciennete_plafond: 25,
  jours_mois: 30,
};

export function champsDuRegime(code: string): ChampRegime[] {
  return CHAMPS_REGIME.filter((c) => !c.regimes || c.regimes.includes(code as never));
}

export function valeurChamp(p: RegimeJson, cle: string): number {
  const v = p[cle];
  return typeof v === "number" ? v : (DEFAUTS_ANCIENNETE[cle] ?? 0);
}

/** Vérifie un barème (mêmes règles que le serveur). Renvoie un message ou null. */
export function erreurBareme(b: Bareme): string | null {
  for (let i = 0; i < b.length; i++) {
    const [max, taux] = b[i];
    if (!(taux >= 0 && taux <= 100)) return `Tranche ${i + 1} : taux entre 0 et 100 %`;
    if (max === null && i !== b.length - 1) return `Tranche ${i + 1} : seule la dernière tranche peut être sans plafond`;
    if (max !== null && max < 0) return `Tranche ${i + 1} : plafond invalide`;
    const prev = i > 0 ? b[i - 1][0] : null;
    if (max !== null && prev !== null && max <= prev) return `Tranche ${i + 1} : le plafond doit dépasser celui de la tranche précédente`;
  }
  return null;
}

/** Vérifie une valeur simple. Renvoie un message ou null. */
export function erreurChamp(champ: ChampRegime, v: number): string | null {
  if (!Number.isFinite(v) || v < 0) return "Valeur positive attendue";
  if (champ.unite === "%" && v > 100) return "100 % maximum";
  if ((champ.cle === "arrondi_unite" || champ.cle === "jours_mois") && v < 1) return "1 minimum";
  return null;
}

/** Ne renvoie que les clés modifiées, pour un enregistrement et un historique précis. */
export function changementsRegime(avant: RegimeJson, apres: RegimeJson): RegimeJson {
  const out: RegimeJson = {};
  for (const [k, v] of Object.entries(apres)) {
    if (JSON.stringify(avant[k]) !== JSON.stringify(v)) out[k] = v;
  }
  return out;
}
