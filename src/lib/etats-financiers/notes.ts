// Notes annexes SYSCOHADA calculables depuis la balance (détail par sous-compte).
//
// Chaque section a un total calculé sur l'ensemble de ses comptes ; si des
// sous-comptes ne tombent dans aucune ligne de détail, une ligne « non ventilé »
// les reprend, pour que le détail égale toujours le total.
//
// Les notes qui demandent des informations hors comptabilité (effectifs,
// échéances, engagements, commentaires…) restent à saisir dans la liasse.

import type { BalanceRow } from "@/lib/compta-api";

/** actif : solde débiteur ; passif : solde créditeur ; charges / produits : exercice. */
type Source = "actif" | "passif" | "charges" | "produits";

type Detail = { libelle: string; prefixes: string[]; exclus?: string[] };
type Section = {
  total: string;
  prefixes: string[];
  exclus?: string[];
  source?: Source;
  lignes: Detail[];
};
type NoteDef = {
  numero: string;
  titre: string;
  source: Source;
  sections: Section[];
  /** Total des sections, si la note en a plusieurs. */
  totalGeneral?: string;
  /** Dépréciations déduites du total brut de la première section. */
  depreciations?: { libelle: string; prefixes: string[]; totalNet: string };
};

export const NOTES: NoteDef[] = [
  {
    numero: "7",
    titre: "Clients",
    source: "actif",
    sections: [
      {
        total: "TOTAL BRUT CLIENTS",
        prefixes: ["41"],
        exclus: ["419"],
        lignes: [
          {
            libelle: "Clients (hors réserves de propriété et groupe)",
            prefixes: ["411", "413"],
            exclus: ["4112", "4116"],
          },
          {
            libelle: "Clients effets à recevoir (hors groupe)",
            prefixes: ["412"],
            exclus: ["4122"],
          },
          { libelle: "Clients avec réserves de propriété", prefixes: ["4116"] },
          { libelle: "Clients et effets à recevoir groupe", prefixes: ["4112", "4122"] },
          { libelle: "Créances sur cession d'immobilisations", prefixes: ["414"] },
          { libelle: "Clients effets escomptés et non échus", prefixes: ["415"] },
          { libelle: "Créances litigieuses ou douteuses", prefixes: ["416"] },
          { libelle: "Clients produits à recevoir", prefixes: ["418"] },
        ],
      },
      {
        total: "TOTAL CLIENTS CRÉDITEURS",
        prefixes: ["41"],
        source: "passif",
        lignes: [
          { libelle: "Clients, avances reçues", prefixes: ["419"] },
          { libelle: "Autres clients créditeurs", prefixes: ["41"], exclus: ["419"] },
        ],
      },
    ],
    depreciations: {
      libelle: "Dépréciations des comptes clients",
      prefixes: ["491"],
      totalNet: "TOTAL NET DE DÉPRÉCIATIONS",
    },
  },
  {
    numero: "11",
    titre: "Disponibilités",
    source: "actif",
    sections: [
      {
        total: "TOTAL BRUT DISPONIBILITÉS",
        prefixes: ["52", "53", "54", "55", "57", "58"],
        lignes: [
          { libelle: "Banques locales", prefixes: ["521"] },
          { libelle: "Banques autres États région", prefixes: ["522"] },
          { libelle: "Banques, dépôts à terme", prefixes: ["525"] },
          { libelle: "Autres banques", prefixes: ["523", "524"] },
          { libelle: "Banques intérêts courus", prefixes: ["526"] },
          { libelle: "Chèques postaux", prefixes: ["531"] },
          { libelle: "Autres établissements financiers", prefixes: ["53"], exclus: ["531", "536"] },
          { libelle: "Établissements financiers intérêts courus", prefixes: ["536"] },
          { libelle: "Instruments de trésorerie", prefixes: ["54"] },
          { libelle: "Instruments de monnaie électronique", prefixes: ["55"] },
          { libelle: "Caisse", prefixes: ["57"] },
          { libelle: "Régies d'avances et virements accréditifs", prefixes: ["58"] },
        ],
      },
    ],
    depreciations: {
      libelle: "Dépréciations",
      // 592 à 594 : banques, établissements financiers, instruments de trésorerie.
      prefixes: ["592", "593", "594"],
      totalNet: "TOTAL NET DE DÉPRÉCIATIONS",
    },
  },
  {
    numero: "17",
    titre: "Fournisseurs d'exploitation",
    source: "passif",
    sections: [
      {
        total: "TOTAL FOURNISSEURS",
        prefixes: ["40"],
        exclus: ["409"],
        lignes: [
          {
            libelle: "Fournisseurs dettes en compte (hors groupe)",
            prefixes: ["401"],
            exclus: ["4012", "4013", "4016", "4017"],
          },
          { libelle: "Fournisseurs, sous-traitants", prefixes: ["4013"] },
          { libelle: "Fournisseurs, réserve de propriété", prefixes: ["4016"] },
          { libelle: "Fournisseurs, retenue de garantie", prefixes: ["4017"] },
          {
            libelle: "Fournisseurs effets à payer (hors groupe)",
            prefixes: ["402"],
            exclus: ["4022"],
          },
          { libelle: "Fournisseurs, dettes et effets à payer groupe", prefixes: ["4012", "4022"] },
          { libelle: "Fournisseurs, acquisitions courantes d'immobilisations", prefixes: ["404"] },
          { libelle: "Fournisseurs factures non parvenues", prefixes: ["408"] },
        ],
      },
      {
        total: "TOTAL FOURNISSEURS DÉBITEURS",
        prefixes: ["40"],
        source: "actif",
        lignes: [
          { libelle: "Fournisseurs, avances et acomptes", prefixes: ["409"] },
          { libelle: "Autres fournisseurs débiteurs", prefixes: ["40"], exclus: ["409"] },
        ],
      },
    ],
  },
  {
    numero: "18",
    titre: "Dettes fiscales et sociales",
    source: "passif",
    totalGeneral: "TOTAL DETTES SOCIALES ET FISCALES",
    sections: [
      {
        total: "TOTAL DETTES SOCIALES",
        prefixes: ["42", "43"],
        lignes: [
          { libelle: "Personnel, rémunérations dues", prefixes: ["422"] },
          { libelle: "Personnel, congés à payer", prefixes: ["4281"] },
          { libelle: "Autres personnel", prefixes: ["42"], exclus: ["422", "4281"] },
          { libelle: "Caisse de sécurité sociale", prefixes: ["431"] },
          { libelle: "Caisse de retraite", prefixes: ["432"] },
          { libelle: "Autres cotisations et organismes sociaux", prefixes: ["433"] },
          { libelle: "Autres charges sociales à payer", prefixes: ["438"] },
        ],
      },
      {
        total: "TOTAL DETTES FISCALES",
        prefixes: ["44"],
        lignes: [
          { libelle: "État, impôts sur les bénéfices", prefixes: ["441"] },
          { libelle: "État, impôts et taxes", prefixes: ["442", "446"] },
          { libelle: "État, TVA", prefixes: ["443", "444"] },
          { libelle: "État, impôts retenus à la source", prefixes: ["447"] },
          {
            libelle: "Autres dettes État",
            prefixes: ["44"],
            exclus: ["441", "442", "443", "444", "446", "447"],
          },
        ],
      },
    ],
  },
  {
    numero: "21",
    titre: "Chiffre d'affaires et autres produits",
    source: "produits",
    totalGeneral: "TOTAL",
    sections: [
      {
        total: "TOTAL : CHIFFRE D'AFFAIRES",
        prefixes: ["701", "702", "703", "704", "705", "706", "707", "708", "709"],
        lignes: [
          { libelle: "Ventes de marchandises", prefixes: ["701"] },
          { libelle: "Ventes de produits fabriqués", prefixes: ["702", "703", "704"] },
          { libelle: "Ventes de travaux et services", prefixes: ["705", "706"] },
          { libelle: "Produits accessoires", prefixes: ["707", "708", "709"] },
        ],
      },
      {
        total: "TOTAL : AUTRES PRODUITS",
        prefixes: ["71", "72", "75"],
        lignes: [
          { libelle: "Production immobilisée", prefixes: ["72"] },
          { libelle: "Subventions d'exploitation", prefixes: ["71"] },
          { libelle: "Autres produits", prefixes: ["75"] },
        ],
      },
    ],
  },
  {
    numero: "22",
    titre: "Achats",
    source: "charges",
    sections: [
      {
        total: "TOTAL : ACHATS DE MARCHANDISES",
        prefixes: ["601"],
        lignes: [],
      },
      {
        total: "TOTAL : ACHATS MATIÈRES PREMIÈRES ET FOURNITURES LIÉES",
        prefixes: ["602"],
        lignes: [],
      },
      {
        total: "TOTAL : AUTRES ACHATS",
        prefixes: ["604", "605", "608", "609"],
        lignes: [
          { libelle: "Matières consommables", prefixes: ["6041"] },
          { libelle: "Matières combustibles", prefixes: ["6042"] },
          { libelle: "Produits d'entretien", prefixes: ["6043"] },
          { libelle: "Fournitures d'atelier, d'usine et de magasin", prefixes: ["6044"] },
          { libelle: "Eau", prefixes: ["6051"] },
          { libelle: "Électricité", prefixes: ["6052"] },
          { libelle: "Autres énergies", prefixes: ["6053"] },
          { libelle: "Fournitures d'entretien", prefixes: ["6054"] },
          { libelle: "Fournitures de bureau", prefixes: ["6055"] },
          { libelle: "Petit matériel et outillage", prefixes: ["6056"] },
          {
            libelle: "Achats d'études, prestations de services, travaux et matériels",
            prefixes: ["6057"],
          },
          { libelle: "Achats d'emballages", prefixes: ["608"] },
          { libelle: "Rabais, remises et ristournes (non ventilés)", prefixes: ["609"] },
        ],
      },
    ],
  },
  {
    numero: "23",
    titre: "Transports",
    source: "charges",
    sections: [
      {
        total: "TOTAL",
        prefixes: ["61"],
        lignes: [
          { libelle: "Transports sur ventes", prefixes: ["612"] },
          { libelle: "Transports pour le compte de tiers", prefixes: ["613"] },
          { libelle: "Transport du personnel", prefixes: ["614"] },
          { libelle: "Transports de plis", prefixes: ["616"] },
          { libelle: "Voyages et déplacements", prefixes: ["6181"] },
          { libelle: "Transports entre établissements ou chantiers", prefixes: ["6182"] },
          { libelle: "Transports administratifs", prefixes: ["6183"] },
        ],
      },
    ],
  },
  {
    numero: "24",
    titre: "Services extérieurs",
    source: "charges",
    sections: [
      {
        total: "TOTAL",
        prefixes: ["62", "63"],
        lignes: [
          { libelle: "Sous-traitance générale", prefixes: ["621"] },
          { libelle: "Locations et charges locatives", prefixes: ["622"] },
          { libelle: "Redevances de location-acquisition", prefixes: ["623"] },
          { libelle: "Entretien, réparations et maintenance", prefixes: ["624"] },
          { libelle: "Primes d'assurance", prefixes: ["625"] },
          { libelle: "Études, recherches et documentation", prefixes: ["626"] },
          { libelle: "Publicité, publications, relations publiques", prefixes: ["627"] },
          { libelle: "Frais de télécommunications", prefixes: ["628"] },
          { libelle: "Frais bancaires", prefixes: ["631"] },
          { libelle: "Rémunérations d'intermédiaires et de conseils", prefixes: ["632"] },
          { libelle: "Frais de formation du personnel", prefixes: ["633"] },
          {
            libelle: "Redevances pour brevets, licences, logiciels et droits similaires",
            prefixes: ["634"],
          },
          { libelle: "Cotisations", prefixes: ["635"] },
          { libelle: "Rémunérations de personnel extérieur à l'entité", prefixes: ["637"] },
          { libelle: "Autres charges externes", prefixes: ["638"] },
        ],
      },
    ],
  },
  {
    numero: "25",
    titre: "Impôts et taxes",
    source: "charges",
    sections: [
      {
        total: "TOTAL",
        prefixes: ["64"],
        lignes: [
          { libelle: "Impôts et taxes directs", prefixes: ["641"] },
          { libelle: "Impôts et taxes indirects", prefixes: ["645"] },
          { libelle: "Droits d'enregistrement", prefixes: ["646"] },
          { libelle: "Pénalités et amendes fiscales", prefixes: ["647"] },
          { libelle: "Autres impôts et taxes", prefixes: ["648"] },
        ],
      },
    ],
  },
  {
    numero: "26",
    titre: "Autres charges",
    source: "charges",
    sections: [
      {
        total: "TOTAL",
        prefixes: ["65"],
        lignes: [
          { libelle: "Pertes sur créances clients", prefixes: ["6511"] },
          { libelle: "Pertes sur autres débiteurs", prefixes: ["651"], exclus: ["6511"] },
          { libelle: "Quote-part de résultat sur opérations faites en commun", prefixes: ["652"] },
          {
            libelle: "Valeur comptable des cessions courantes d'immobilisations",
            prefixes: ["654"],
          },
          { libelle: "Perte de change sur créances et dettes commerciales", prefixes: ["656"] },
          { libelle: "Pénalités et amendes pénales", prefixes: ["657"] },
          {
            libelle: "Indemnités de fonction et autres rémunérations d'administrateurs",
            prefixes: ["6581"],
          },
          { libelle: "Dons et mécénat", prefixes: ["6582", "6583"] },
          {
            libelle: "Autres charges diverses",
            prefixes: ["658"],
            exclus: ["6581", "6582", "6583"],
          },
          {
            libelle: "Charges pour dépréciations et provisions pour risques à court terme",
            prefixes: ["659"],
          },
        ],
      },
    ],
  },
];

export type NiveauLigne = "detail" | "total" | "general";
export type LigneNote = { libelle: string; montant: number; niveau: NiveauLigne };
export type NoteCalculee = { numero: string; titre: string; lignes: LigneNote[] };

const correspond = (compte: string, prefixes: string[], exclus: string[] = []) =>
  prefixes.some((p) => compte.startsWith(p)) && !exclus.some((p) => compte.startsWith(p));

/**
 * @param cumul   balance cumulée à la clôture (notes de bilan).
 * @param periode balance de l'exercice (notes de charges et de produits).
 */
export function calculerNotes(cumul: BalanceRow[], periode: BalanceRow[]): NoteCalculee[] {
  // Montant d'un compte vu depuis une source ; null si le compte n'en relève pas
  // (ex. client créditeur pour une section d'actif).
  const montant = (r: BalanceRow, source: Source): number | null => {
    if (source === "actif") return r.solde > 0 ? r.solde : null;
    if (source === "passif") return r.solde < 0 ? -r.solde : null;
    return source === "charges" ? r.solde : -r.solde;
  };
  const somme = (source: Source, prefixes: string[], exclus?: string[]) => {
    const rows = source === "charges" || source === "produits" ? periode : cumul;
    let s = 0;
    for (const r of rows) {
      const compte = r.compte.trim();
      if (!correspond(compte, prefixes, exclus)) continue;
      s += montant(r, source) ?? 0;
    }
    return Math.round(s * 100) / 100 || 0;
  };

  return NOTES.map((note) => {
    const lignes: LigneNote[] = [];
    let general = 0;
    note.sections.forEach((section, i) => {
      const source = section.source ?? note.source;
      let detail = 0;
      for (const l of section.lignes) {
        // Une ligne ne reprend que les comptes de sa section (ex. « 41 » hors 419).
        const v = somme(source, l.prefixes, [...(l.exclus ?? []), ...(section.exclus ?? [])]);
        detail += v;
        lignes.push({ libelle: l.libelle, montant: v, niveau: "detail" });
      }
      const total = somme(source, section.prefixes, section.exclus);
      const reste = Math.round((total - detail) * 100) / 100;
      if (section.lignes.length && reste)
        lignes.push({ libelle: "Autres comptes (non ventilé)", montant: reste, niveau: "detail" });
      lignes.push({ libelle: section.total, montant: total, niveau: "total" });
      general += total;
      if (i === 0 && note.depreciations) {
        const dep = -somme("passif", note.depreciations.prefixes);
        lignes.push({ libelle: note.depreciations.libelle, montant: dep, niveau: "detail" });
        lignes.push({
          libelle: note.depreciations.totalNet,
          montant: total + dep,
          niveau: "total",
        });
      }
    });
    if (note.totalGeneral)
      lignes.push({ libelle: note.totalGeneral, montant: general, niveau: "general" });
    return { numero: note.numero, titre: note.titre, lignes };
  });
}
