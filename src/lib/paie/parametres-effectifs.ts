// Ce que le moteur SQL (paie_calculer_bulletin) lit réellement, pour l'afficher à côté
// de la liste éditable de Paramètres Paie CI. Les deux pouvaient diverger sans le montrer :
// la table parametres_paie contient des codes que le moteur ignore (ancien barème ITS,
// plafond 2 700 000, PF 5,75 %…), tandis que seules les clés reconnues par
// _paie_parametres_effectifs surchargent paie_regimes.parametres.

export type Unite = "%" | "FCFA";
export type CleMoteur = {
  cle: string;
  libelle: string;
  unite: Unite;
  categorie: "CNPS" | "CMU" | "ITS" | "CN" | "Autre";
  part: "salariale" | "patronale" | "—";
};

// Clés obligatoires vérifiées par _paie_parametres_controle (migration 0101), dans l'ordre d'affichage.
export const CLES_MOTEUR: CleMoteur[] = [
  { cle: "cr_taux", libelle: "Retraite (CNPS)", unite: "%", categorie: "CNPS", part: "salariale" },
  {
    cle: "cr_plafond",
    libelle: "Plafond retraite",
    unite: "FCFA",
    categorie: "CNPS",
    part: "salariale",
  },
  {
    cle: "retraite_pat_taux",
    libelle: "Retraite (CNPS)",
    unite: "%",
    categorie: "CNPS",
    part: "patronale",
  },
  {
    cle: "retraite_pat_plafond",
    libelle: "Plafond retraite",
    unite: "FCFA",
    categorie: "CNPS",
    part: "patronale",
  },
  {
    cle: "pf_taux",
    libelle: "Prestations familiales",
    unite: "%",
    categorie: "CNPS",
    part: "patronale",
  },
  {
    cle: "maternite_taux",
    libelle: "Assurance maternité",
    unite: "%",
    categorie: "CNPS",
    part: "patronale",
  },
  {
    cle: "at_taux",
    libelle: "Accidents du travail",
    unite: "%",
    categorie: "CNPS",
    part: "patronale",
  },
  {
    cle: "plafond_prestations",
    libelle: "Plafond PF / maternité / AT",
    unite: "FCFA",
    categorie: "CNPS",
    part: "patronale",
  },
  {
    cle: "cmu_salarie",
    libelle: "CMU (par mois)",
    unite: "FCFA",
    categorie: "CMU",
    part: "salariale",
  },
  {
    cle: "cmu_patronal",
    libelle: "CMU (par mois)",
    unite: "FCFA",
    categorie: "CMU",
    part: "patronale",
  },
  {
    cle: "ricf_par_demi_part",
    libelle: "Réduction charges de famille / demi-part",
    unite: "FCFA",
    categorie: "ITS",
    part: "salariale",
  },
  {
    cle: "its_taux_forfait",
    libelle: "ITS forfaitaire (régime 2022)",
    unite: "%",
    categorie: "ITS",
    part: "salariale",
  },
  {
    cle: "cn_abattement",
    libelle: "Abattement CN (régime 2022)",
    unite: "%",
    categorie: "CN",
    part: "salariale",
  },
  {
    cle: "transport_plafond",
    libelle: "Transport non imposable (plafond)",
    unite: "FCFA",
    categorie: "Autre",
    part: "—",
  },
  { cle: "arrondi_unite", libelle: "Arrondi du net", unite: "FCFA", categorie: "Autre", part: "—" },
];

// Même correspondance que _paie_parametres_effectifs (migration 0101) : code saisi → clé du moteur.
const ALIAS: Record<string, string> = {
  CNPS_RETRAITE_SALARIE: "cr_taux",
  CNPS_SALARIE_RETRAITE: "cr_taux",
  CNPS_RETRAITE_PATRONAL: "retraite_pat_taux",
  CNPS_PATRONAL_RETRAITE: "retraite_pat_taux",
  CNPS_ACCIDENT_TRAVAIL: "at_taux",
  CNPS_PATRONAL_AT: "at_taux",
  CMU_SALARIE: "cmu_salarie",
  CMU_PATRONAL: "cmu_patronal",
};
const LIBRES = new Set(["anciennete_taux_par_an", "anciennete_plafond", "jours_mois"]);

/**
 * Clé du moteur surchargée par une ligne de parametres_paie, ou null si le moteur l'ignore.
 * Le moteur lit la colonne `cle` (pas `code`) et n'accepte que des nombres décimaux.
 */
export function cleMoteurDe(
  cle: string | null | undefined,
  valeur: string | number | null | undefined,
  regime: Record<string, unknown>,
): string | null {
  if (!cle) return null;
  const k = ALIAS[cle.toUpperCase()] ?? cle.toLowerCase();
  const v = String(valeur ?? "");
  if (k in regime && /^-?[0-9]+(\.[0-9]+)?$/.test(v)) return k;
  if (LIBRES.has(k) && /^[0-9]+(\.[0-9]+)?$/.test(v)) return k;
  return null;
}

export type Tranche = { de: number; a: number | null; taux: number };

/** Barème jsonb [[borne, taux], …, [null, taux]] → tranches lisibles. */
export function tranchesDe(bareme: unknown): Tranche[] {
  if (!Array.isArray(bareme)) return [];
  let de = 0;
  return bareme.map((t) => {
    const [max, taux] = t as [number | null, number];
    const tr = { de, a: max, taux };
    if (max !== null) de = max + 1;
    return tr;
  });
}

/** Valeur numérique d'une clé, ou null si absente ou illisible (jamais 0 par défaut). */
export function valeurNumerique(p: Record<string, unknown>, cle: string): number | null {
  const v = p[cle];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
