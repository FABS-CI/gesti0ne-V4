// Correspondance entre les notes calculées par l'ERP (notes.ts) et les lignes des
// feuilles « NOTE n » du modèle de liasse DGI 2025.
//
// Une ligne de note est placée sur la ligne du modèle de même libellé, à la mise
// en forme près (accents, casse, apostrophes, virgules, renvois « (1) »). Aucun
// rapprochement approximatif : les libellés qui diffèrent sont listés ici un par
// un. Une correspondance qui suppose une information absente de l'ERP (zone
// géographique, groupe) porte une hypothèse, reportée dans le classeur exporté.

export type CorrespondanceNote = {
  /** Libellé de la ligne calculée (notes.ts). */
  ligne: string;
  /** Libellé de la ligne du modèle. */
  modele: string;
  /** -1 : montant à reporter en positif (les lignes de dépréciation le sont d'office). */
  signe?: -1;
  /** Hypothèse faite pour placer le montant, à vérifier avant dépôt. */
  hypothese?: string;
};

const ZONE =
  "l'ERP ne distingue pas les ventes et achats hors Côte d'Ivoire ou de groupe : montant classé « dans l'Etat partie »";
const GROUPE = "l'ERP ne distingue pas les opérations de groupe : montant classé « hors groupe »";

export const CORRESPONDANCES_NOTES_2025: Record<string, CorrespondanceNote[]> = {
  "7": [
    {
      ligne: "Clients effets à recevoir (hors groupe)",
      modele: "Clients effets à recevoir (hors réserves de propriété et groupe)",
    },
    {
      ligne: "Clients, avances reçues",
      modele: "Clients, avances reçues hors groupe",
      hypothese: GROUPE,
    },
  ],
  "11": [
    { ligne: "Banques, dépôts à terme", modele: "Banques, dépôt à terme" },
    { ligne: "Autres établissements financiers", modele: "Autres établissement financiers" },
    {
      ligne: "Établissements financiers intérêts courus",
      modele: "Etablissement financiers intérêts courus",
    },
  ],
  "17": [
    {
      ligne: "Fournisseurs factures non parvenues",
      modele: "Fournisseurs factures non parvenues (hors groupe)",
      hypothese: GROUPE,
    },
    {
      ligne: "Fournisseurs, avances et acomptes",
      modele: "Fournisseurs, avances et acomptes (hors groupe)",
      hypothese: GROUPE,
    },
  ],
  "21": [
    {
      ligne: "Ventes de marchandises",
      modele: "Ventes de marchandises dans l'Etat partie",
      hypothese: ZONE,
    },
    {
      ligne: "Ventes de produits fabriqués",
      modele: "Ventes de produits fabriqués dans l'Etat partie",
      hypothese: ZONE,
    },
    {
      ligne: "Ventes de travaux et services",
      modele: "Ventes de travaux et services dans l'Etat partie",
      hypothese: ZONE,
    },
    {
      ligne: "Produits accessoires",
      modele:
        'Produits accessoires à détailler par nature d\'activité économique : dont le détail de la rubrique "Divers" de la Fiche R2',
    },
  ],
  "22": [
    {
      ligne: "TOTAL : ACHATS DE MARCHANDISES",
      modele: "Achats de marchandises dans l'Etat partie",
      hypothese: ZONE,
    },
    {
      ligne: "TOTAL : ACHATS MATIÈRES PREMIÈRES ET FOURNITURES LIÉES",
      modele: "Achats de matières premières et fournitures liées dans l'Etat partie",
      hypothese: ZONE,
    },
    { ligne: "Fournitures d'entretien", modele: "Fourniture d'entretien" },
    { ligne: "Fournitures de bureau", modele: "Fourniture de bureau" },
    { ligne: "Petit matériel et outillage", modele: "Petit matériel et outillages" },
    {
      ligne: "Achats d'études, prestations de services, travaux et matériels",
      modele: "Achats études, prestations de services, de travaux matériels et équipements",
    },
    {
      ligne: "Rabais, remises et ristournes (non ventilés)",
      modele: "Remises rabais, remises et ristournes (non ventilés)",
    },
  ],
  "23": [
    { ligne: "Voyages et déplacements", modele: "Voyage déplacement (transport)" },
    {
      ligne: "Transports entre établissements ou chantiers",
      modele: "Transport entre établissements ou chantiers",
    },
  ],
  "24": [
    { ligne: "Redevances de location-acquisition", modele: "Redevances de location acquisition" },
    {
      ligne: "Redevances pour brevets, licences, logiciels et droits similaires",
      modele: "Redevances pour brevets, licences, logiciels, concession et droits similaires",
    },
  ],
  "26": [
    {
      ligne: "Charges pour dépréciations et provisions pour risques à court terme",
      modele:
        "Charges pour dépréciations et provisions pour risques à court terme d'exploitation (voir note 28)",
    },
  ],
};

/** Libellé comparable : sans accents, casse, apostrophes typographiques, virgules ni renvois. */
export function libelleComparable(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’‘`]/g, "'")
    .replace(/\(\d\)/g, "")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Notes 3 (tableaux de mouvements) : colonne du modèle DGI 2025 pour chaque
 * colonne calculée (notes-immobilisations.ts). Une cellule du modèle qui contient
 * une formule n'est jamais écrite.
 */
export const COLONNES_TABLEAUX_2025: Record<string, Record<string, string>> = {
  "3A": {
    ouverture: "D",
    acquisitions: "E",
    virements_plus: "F",
    reevaluation: "G",
    cessions: "H",
    virements_moins: "I",
    cloture: "J",
  },
  "3C": {
    ouverture: "D",
    dotations: "F",
    diminutions: "H",
    reprises: "J",
    virements: "L",
    cloture: "N",
  },
  "3C BIS": { ouverture: "D", dotations: "F", diminutions: "H", cloture: "J" },
  "3D": { brut: "D", amort: "E", vnc: "F", prix: "G", plus_value: "H" },
};
