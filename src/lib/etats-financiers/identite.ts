// Identification de l'entité pour la liasse (page de garde, fiche R1, en-têtes).
//
// Valeurs permanentes, saisies une fois : réglages propres à la liasse
// (parametres_entreprise, clé « liasse.<champ> »), sinon reprises des paramètres
// FNE déjà renseignés dans l'ERP. Dates et durée viennent de l'exercice.

export type ChampIdentite = {
  cle: string;
  libelle: string;
  /** Code de la fiche R1 ou de la page de garde. */
  ref?: string;
  /** Requis pour déposer la liasse. */
  requis?: boolean;
  /** Paramètre FNE repris si le champ n'est pas saisi pour la liasse. */
  fne?: string;
};

export const CHAMPS_IDENTITE: ChampIdentite[] = [
  {
    cle: "denomination",
    libelle: "Dénomination sociale",
    ref: "ZJ",
    requis: true,
    fne: "company_name",
  },
  { cle: "sigle", libelle: "Sigle usuel", ref: "ZJ" },
  { cle: "ncc", libelle: "N° de compte contribuable (NCC)", requis: true, fne: "company_ncc" },
  { cle: "ntd", libelle: "N° de télédéclarant (NTD)", requis: true, fne: "company_idu" },
  {
    cle: "rccm",
    libelle: "N° Registre du commerce (RCCM)",
    ref: "ZE",
    requis: true,
    fne: "company_rccm",
  },
  { cle: "centre_depot", libelle: "Centre de dépôt", requis: true, fne: "company_centre_impots" },
  {
    cle: "adresse",
    libelle: "Adresse (boîte postale, ville)",
    ref: "ZK",
    requis: true,
    fne: "company_adresse",
  },
  { cle: "adresse_geographique", libelle: "Adresse géographique complète", ref: "ZL" },
  { cle: "telephone", libelle: "Téléphone", ref: "ZK", fne: "company_telephone" },
  { cle: "email", libelle: "Adresse e-mail", ref: "ZK", fne: "company_email" },
  { cle: "code_activite", libelle: "Code activité principale", ref: "ZI" },
  { cle: "activite", libelle: "Activité principale exercée", ref: "ZM", requis: true },
  { cle: "caisse_sociale", libelle: "N° de caisse sociale (CNPS)", ref: "ZG" },
  { cle: "code_importateur", libelle: "N° code importateur", ref: "ZH" },
  { cle: "contact", libelle: "Personne à contacter (nom, qualité)", ref: "ZO" },
  { cle: "expert_comptable", libelle: "Expert-comptable (visa)", ref: "ZQ" },
  { cle: "signataire_nom", libelle: "Signataire des états financiers", ref: "ZT", requis: true },
  { cle: "signataire_qualite", libelle: "Qualité du signataire", ref: "ZU", requis: true },
];

export const CLE_PARAMETRE = (cle: string) => `liasse.${cle}`;
export const CATEGORIE_PARAMETRES = "etats_financiers";

export type ValeurIdentite = { valeur: string; origine: "liasse" | "fne" | "absent" };

export function resoudreIdentite(
  liasse: Record<string, string | null | undefined>,
  fne: Record<string, string | null | undefined>,
): Record<string, ValeurIdentite> {
  const out: Record<string, ValeurIdentite> = {};
  for (const c of CHAMPS_IDENTITE) {
    const propre = liasse[CLE_PARAMETRE(c.cle)]?.trim();
    const repris = c.fne ? fne[c.fne]?.trim() : undefined;
    out[c.cle] = propre
      ? { valeur: propre, origine: "liasse" }
      : repris
        ? { valeur: repris, origine: "fne" }
        : { valeur: "", origine: "absent" };
  }
  return out;
}

export const champsManquants = (identite: Record<string, ValeurIdentite>) =>
  CHAMPS_IDENTITE.filter((c) => c.requis && !identite[c.cle]?.valeur);
