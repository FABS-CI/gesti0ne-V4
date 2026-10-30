// Notes annexes SYSCOHADA calculables depuis la balance (détail par sous-compte).
//
// Chaque section a un total calculé sur l'ensemble de ses comptes ; si des
// sous-comptes ne tombent dans aucune ligne de détail, une ligne « non ventilé »
// les reprend, pour que le détail égale toujours le total.
//
// Les notes qui demandent des informations hors comptabilité (effectifs,
// échéances, engagements, commentaires…) restent à saisir dans la liasse.

import type { BalanceRow } from "@/lib/compta-api";

/**
 * actif : solde débiteur ; passif : solde créditeur ; charges / produits : exercice ;
 * capitaux : solde créditeur signé (un report à nouveau débiteur reste négatif).
 */
type Source = "actif" | "passif" | "capitaux" | "charges" | "produits";

type Detail = { libelle: string; prefixes: string[]; exclus?: string[] };
type Section = {
  /** Absent : lignes sans total dans le modèle (ex. réserves libres, report à nouveau). */
  total?: string;
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
  depreciations?: { lignes: Array<{ libelle: string; prefixes: string[] }>; totalNet: string };
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
      lignes: [{ libelle: "Dépréciations des comptes clients", prefixes: ["491"] }],
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
      // 592 à 594 : banques, établissements financiers, instruments de trésorerie.
      lignes: [{ libelle: "Dépréciations", prefixes: ["592", "593", "594"] }],
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
  // ─── Notes ajoutées : libellés exacts du modèle DGI ──────────────────────────
  // Seuls les comptes dont le rattachement est certain sont ventilés ; le reste
  // apparaît en « non ventilé » (signalé à l'export), jamais sur une ligne au hasard.
  {
    numero: "4",
    titre: "Immobilisations financières",
    source: "actif",
    sections: [
      {
        total: "TOTAL BRUT",
        prefixes: ["26", "27"],
        lignes: [
          { libelle: "Titres de participation", prefixes: ["26"] },
          { libelle: "Prêts et créances", prefixes: ["271"] },
          { libelle: "Prêt au personnel", prefixes: ["272"] },
          { libelle: "Créances sur l'état", prefixes: ["273"] },
          { libelle: "Titres immobilisés", prefixes: ["274"] },
          { libelle: "Dépôts et cautionnements", prefixes: ["275"] },
          { libelle: "Intérêts courus", prefixes: ["276"] },
          {
            libelle: "Créances rattachées à des avances et participations à des GIE",
            prefixes: ["277"],
          },
          { libelle: "Immobilisations financières diverses", prefixes: ["278"] },
        ],
      },
    ],
    depreciations: {
      lignes: [
        { libelle: "Dépréciations des titres de participation", prefixes: ["296"] },
        { libelle: "Dépréciations des autres immobilisations financières", prefixes: ["297"] },
      ],
      totalNet: "TOTAL NET DE DEPRECIATION",
    },
  },
  {
    numero: "5",
    titre: "Actif circulant HAO",
    source: "actif",
    sections: [
      {
        total: "TOTAL BRUT",
        prefixes: ["48"],
        lignes: [
          { libelle: "Créances sur cessions d'immobilisations", prefixes: ["485"] },
          {
            libelle: "Autres créances hors activités ordinaires",
            prefixes: ["48"],
            exclus: ["485"],
          },
        ],
      },
    ],
    depreciations: {
      lignes: [{ libelle: "Dépréciations des créances HAO", prefixes: ["498"] }],
      totalNet: "TOTAL NET DE DEPRECIATIONS",
    },
  },
  {
    numero: "6",
    titre: "Stocks et en cours",
    source: "actif",
    sections: [
      {
        total: "TOTAL BRUT STOCKS ET EN COURS",
        prefixes: ["31", "32", "33", "34", "35", "36", "37", "38"],
        lignes: [
          { libelle: "Marchandises", prefixes: ["31"] },
          { libelle: "Matières premières et fournitures liées", prefixes: ["32"] },
          { libelle: "Autres approvisionnements", prefixes: ["33"] },
          { libelle: "Produits en cours", prefixes: ["34"] },
          { libelle: "Services en cours", prefixes: ["35"] },
          { libelle: "Produits finis", prefixes: ["36"] },
          { libelle: "Produits intermédiaires", prefixes: ["37"] },
          { libelle: "Stocks en cours de route, en consignation ou en dépôt", prefixes: ["38"] },
        ],
      },
    ],
    depreciations: {
      lignes: [{ libelle: "Dépréciations des stocks", prefixes: ["39"] }],
      totalNet: "TOTAL NET DE DEPRECIATIONS",
    },
  },
  {
    numero: "8",
    titre: "Autres créances",
    source: "actif",
    sections: [
      {
        // Mêmes comptes que le poste BJ du bilan.
        total: "TOTAL BRUT AUTRES CREANCES",
        prefixes: ["42", "43", "44", "45", "46", "47", "185"],
        exclus: ["478", "479"],
        lignes: [
          { libelle: "Personnel", prefixes: ["42"] },
          { libelle: "Organismes sociaux", prefixes: ["43"] },
          { libelle: "Etat et Collectivités publiques", prefixes: ["44"] },
          { libelle: "Organismes internationaux", prefixes: ["45"] },
          { libelle: "Apporteurs, associés et groupe", prefixes: ["46"] },
          {
            libelle:
              "Compte transitoire ajustement spécial lié à la révision du SYSCOHADA (Voir Notes 8A & 8C)",
            prefixes: ["475"],
          },
          { libelle: "Autres débiteurs divers", prefixes: ["47"], exclus: ["475"] },
          {
            libelle: "Comptes permanents non bloqués des établissements et des succursales",
            prefixes: ["185"],
          },
        ],
      },
    ],
    depreciations: {
      lignes: [
        {
          libelle: "Dépréciations des autres créances",
          prefixes: ["492", "493", "494", "495", "496", "497"],
        },
      ],
      totalNet: "TOTAL NET DE DEPRECIATIONS",
    },
  },
  {
    numero: "9",
    titre: "Titres de placement",
    source: "actif",
    sections: [
      {
        total: "TOTAL BRUT TITRES",
        prefixes: ["50"],
        lignes: [
          { libelle: "Titres de trésor et bons de caisse à court terme", prefixes: ["501"] },
          { libelle: "Actions", prefixes: ["502"] },
          { libelle: "Obligations", prefixes: ["503"] },
          { libelle: "Bons de souscription", prefixes: ["504"] },
          { libelle: "Titres négociables hors régions", prefixes: ["505"] },
          { libelle: "Intérêts courus", prefixes: ["506"] },
          { libelle: "Autres valeurs assimilées", prefixes: ["508"] },
        ],
      },
    ],
    depreciations: {
      lignes: [{ libelle: "Dépréciations des titres", prefixes: ["590"] }],
      totalNet: "TOTAL NET DE DEPRECIATIONS",
    },
  },
  {
    numero: "10",
    titre: "Valeurs à encaisser",
    source: "actif",
    sections: [
      {
        total: "TOTAL BRUT VALEURS A ENCAISSER",
        prefixes: ["51"],
        lignes: [
          { libelle: "Effets à encaisser", prefixes: ["511"] },
          { libelle: "Effets à l'encaissement", prefixes: ["512"] },
          { libelle: "Chèques à encaisser", prefixes: ["513"] },
          { libelle: "Chèques à l'encaissement", prefixes: ["514"] },
          { libelle: "Cartes de crédit à encaisser", prefixes: ["515"] },
          { libelle: "Autres valeurs à encaisser", prefixes: ["518"] },
        ],
      },
    ],
    depreciations: {
      lignes: [{ libelle: "Dépréciations des valeurs à encaisser", prefixes: ["591"] }],
      totalNet: "TOTAL NET DE DEPRECIATIONS",
    },
  },
  {
    numero: "14",
    titre: "Primes et réserves",
    source: "capitaux",
    sections: [
      {
        total: "TOTAL PRIMES",
        prefixes: ["105"],
        lignes: [
          { libelle: "Primes d'émission", prefixes: ["1051"] },
          { libelle: "Prime d'apport", prefixes: ["1052"] },
          { libelle: "Prime de fusion", prefixes: ["1053"] },
          { libelle: "Prime de conversion", prefixes: ["1054"] },
          { libelle: "Autres primes", prefixes: ["1058"] },
        ],
      },
      {
        total: "TOTAL RESERVES INDISPONIBLES",
        prefixes: ["111", "112", "113"],
        lignes: [
          { libelle: "Réserves légales", prefixes: ["111"] },
          { libelle: "Réserves statutaires", prefixes: ["112"] },
          { libelle: "Réserves de plus-values nettes à long terme", prefixes: ["1131"] },
          {
            libelle:
              "Réserves d'attribution gratuite d'actions au personnel salarié et aux dirigeants",
            prefixes: ["1132"],
          },
          { libelle: "Autres réserves réglementées", prefixes: ["113"], exclus: ["1131", "1132"] },
        ],
      },
      {
        prefixes: [],
        lignes: [
          { libelle: "Réserves libres", prefixes: ["118"] },
          { libelle: "Report à nouveau", prefixes: ["12"] },
        ],
      },
    ],
  },
  {
    numero: "15A",
    titre: "Subventions d'investissement et provisions réglementées",
    source: "capitaux",
    sections: [
      {
        total: "TOTAL SUBVENTIONS",
        prefixes: ["14"],
        lignes: [
          { libelle: "État", prefixes: ["1411"] },
          { libelle: "Régions", prefixes: ["1412"] },
          { libelle: "Départements", prefixes: ["1413"] },
          { libelle: "Communes et collectivités publiques décentralisées", prefixes: ["1414"] },
          { libelle: "Entités publiques ou mixtes", prefixes: ["1415"] },
          { libelle: "Entités et organismes privés", prefixes: ["1416"] },
          { libelle: "Organismes internationaux", prefixes: ["1417"] },
          { libelle: "Autres", prefixes: ["1418", "148"] },
        ],
      },
      {
        total: "TOTAL PROVISIONS REGLEMENTEES",
        prefixes: ["15"],
        lignes: [
          { libelle: "Amortissements dérogatoires", prefixes: ["151"] },
          { libelle: "Plus-value de cession à réinvestir", prefixes: ["152"] },
          { libelle: "Provisions spéciales de réévaluation", prefixes: ["154"] },
          { libelle: "Provisions réglementées relatives aux immobilisations", prefixes: ["155"] },
          { libelle: "Provisions réglementées relatives aux stocks", prefixes: ["156"] },
          { libelle: "Provisions pour investissement", prefixes: ["157"] },
          { libelle: "Autres provisions et fonds réglementés", prefixes: ["153", "158"] },
        ],
      },
    ],
    totalGeneral: "TOTAL SUBVENTIONS ET PROVISIONS REGLEMENTEES",
  },
  {
    numero: "16A",
    titre: "Dettes financières et ressources assimilées",
    source: "passif",
    sections: [
      {
        // Postes DA, DB et DC du bilan.
        total: "TOTAL EMPRUNTS ET DETTES FINANCIERES",
        prefixes: ["16", "181", "182", "183", "184"],
        lignes: [
          { libelle: "Emprunts obligataires", prefixes: ["161"] },
          { libelle: "Emprunts et dettes auprès des établissements de crédit", prefixes: ["162"] },
          { libelle: "Avances reçues de l'Etat", prefixes: ["163"] },
          { libelle: "Avances reçues et comptes courants bloqués", prefixes: ["164"] },
          { libelle: "Dépôts et cautionnements reçus", prefixes: ["165"] },
          { libelle: "Intérêts courus", prefixes: ["166"] },
          { libelle: "Avances et dettes assorties de conditions particulières", prefixes: ["167"] },
          { libelle: "Autres emprunts et dettes", prefixes: ["168"] },
          {
            libelle: "Dettes liées à des participations et sociétés en participation",
            prefixes: ["181", "182", "183"],
          },
          {
            libelle: "Comptes permanents bloqués des établissements et succursales",
            prefixes: ["184"],
          },
        ],
      },
      {
        total: "TOTAL DETTES DE LOCATION ACQUISITION",
        prefixes: ["17"],
        lignes: [
          { libelle: "Crédit bail immobilier", prefixes: ["172"] },
          { libelle: "Crédit bail mobilier", prefixes: ["173"] },
          { libelle: "Location vente", prefixes: ["174"] },
          { libelle: "Intérêts courus", prefixes: ["176"] },
          { libelle: "Autres dettes de location acquisition", prefixes: ["178"] },
        ],
      },
      {
        total: "TOTAL PROVISIONS POUR RISQUES ET CHARGES",
        prefixes: ["19"],
        lignes: [
          { libelle: "Provisions pour litiges", prefixes: ["191"] },
          { libelle: "Provisions pour garantie donnés aux clients", prefixes: ["192"] },
          { libelle: "Provisions pour pertes sur marchés à achèvement futur", prefixes: ["193"] },
          { libelle: "Provisions pour pertes de change", prefixes: ["194"] },
          { libelle: "Provisions pour impôts", prefixes: ["195"] },
          {
            libelle: "Provisions pour pensions et obligations assimilées - engagements de retraite",
            prefixes: ["196"],
          },
        ],
      },
    ],
  },
  {
    numero: "19",
    titre: "Autres dettes et provisions pour risques et charges",
    source: "passif",
    sections: [
      {
        total: "TOTAL DETTES ASSOCIES",
        prefixes: ["45", "46"],
        lignes: [
          { libelle: "Organismes internationaux", prefixes: ["45"] },
          { libelle: "Apporteurs, opérations sur le capital", prefixes: ["461"] },
          { libelle: "Associés, compte courant", prefixes: ["462"] },
          { libelle: "Associés dividendes à payer", prefixes: ["465"] },
          { libelle: "Groupe, comptes courants", prefixes: ["466"] },
          {
            libelle: "Autres dettes associés",
            prefixes: ["46"],
            exclus: ["461", "462", "465", "466"],
          },
        ],
      },
      {
        total: "TOTAL CREDITEURS DIVERS",
        prefixes: ["47"],
        exclus: ["478", "479"],
        lignes: [
          { libelle: "Créditeurs divers", prefixes: ["471"] },
          {
            libelle:
              "Compte transitoire ajustement spécial lié à la révision du SYSCOHADA (Voir Note 8B)",
            prefixes: ["475"],
          },
          {
            libelle: "Autres créditeurs divers",
            prefixes: ["47"],
            exclus: ["471", "472", "473", "474", "475"],
          },
        ],
      },
      {
        total: "TOTAL COMPTES DE LIAISON",
        prefixes: ["185", "186", "187", "188"],
        lignes: [
          {
            libelle: "Comptes permanents non bloqués des établissements et des succursales",
            prefixes: ["185"],
          },
          { libelle: "Comptes de liaison charges et produits", prefixes: ["186", "187"] },
          { libelle: "Comptes de liaison des sociétés en participation", prefixes: ["188"] },
        ],
      },
    ],
    totalGeneral: "TOTAL AUTRES DETTES",
  },
  {
    numero: "20",
    titre: "Banques, crédits d'escompte et de trésorerie",
    source: "passif",
    sections: [
      {
        total: "TOTAL: BANQUES, CREDITS D'ESCOMPTE ET DE TRESORERIE",
        prefixes: ["564", "565"],
        lignes: [
          { libelle: "Escomptes de crédit de campagne", prefixes: ["564"] },
          { libelle: "Escomptes de crédit ordinaires", prefixes: ["565"] },
        ],
      },
      {
        // Poste DR : comptes 52 à 58 créditeurs, 56 hors escomptes.
        total: "TOTAL: BANQUES, CREDITS DE TRESORERIE",
        prefixes: ["52", "53", "54", "55", "56", "57", "58"],
        exclus: ["564", "565"],
        lignes: [
          { libelle: "Banques locales", prefixes: ["521"] },
          { libelle: "Banques autres états région", prefixes: ["522"] },
          { libelle: "Autres Banques", prefixes: ["523", "524", "525"] },
          { libelle: "Banques intérêts courus", prefixes: ["526"] },
          { libelle: "Crédit de trésorerie", prefixes: ["561"] },
        ],
      },
    ],
    totalGeneral: "TOTAL GENERAL",
  },
  {
    numero: "27A",
    titre: "Charges de personnel",
    source: "charges",
    sections: [
      {
        total: "TOTAL",
        prefixes: ["66"],
        lignes: [
          { libelle: "Rémunérations directes versées au personnel national", prefixes: ["661"] },
          {
            libelle: "Rémunérations directes versées au personnel non national",
            prefixes: ["662"],
          },
          { libelle: "Indemnités forfaitaires versées au personnel", prefixes: ["663"] },
          { libelle: "Charges sociales (personnel national)", prefixes: ["664"] },
          { libelle: "Charges sociales (personnel non national)", prefixes: ["665"] },
          {
            libelle: "Rémunérations et charges sociales de l'exploitant individuel",
            prefixes: ["666"],
          },
          { libelle: "Rémunération transférée de personnel extérieur", prefixes: ["667"] },
          { libelle: "Autres charges sociales", prefixes: ["668"] },
        ],
      },
    ],
  },
  {
    numero: "29",
    titre: "Charges et revenus financiers",
    source: "charges",
    sections: [
      {
        total: "SOUS TOTAL : FRAIS FINANCIERS (A)",
        prefixes: ["67"],
        lignes: [
          { libelle: "Intérêts des emprunts", prefixes: ["671"] },
          { libelle: "Intérêts dans loyers de locations acquisition", prefixes: ["672"] },
          { libelle: "Escomptes accordés", prefixes: ["673"] },
          { libelle: "Autres intérêts", prefixes: ["674"] },
          { libelle: "Escomptes des effets de commerce", prefixes: ["675"] },
          { libelle: "Pertes de change financières", prefixes: ["676"] },
          { libelle: "Pertes sur cessions de titres de placement", prefixes: ["677"] },
        ],
      },
      {
        total: "SOUS TOTAL : REVENUS FINANCIERS (B)",
        prefixes: ["77"],
        source: "produits",
        lignes: [
          { libelle: "Intérêts de prêts et créances diverses", prefixes: ["771"] },
          { libelle: "Revenus de participations et autres titres immobilisés", prefixes: ["772"] },
          { libelle: "Escomptes obtenus", prefixes: ["773"] },
          { libelle: "Revenus de placement", prefixes: ["774"] },
          { libelle: "Intérêts dans loyers de location-financement", prefixes: ["775"] },
          { libelle: "Gains de change financiers", prefixes: ["776"] },
          { libelle: "Gains sur cessions de titres de placement", prefixes: ["777"] },
        ],
      },
    ],
  },
];

export type NiveauLigne = "detail" | "total" | "general";
export type LigneNote = {
  libelle: string;
  montant: number;
  niveau: NiveauLigne;
  /** Dépréciation : négative ici, déduite du brut ; positive dans la liasse. */
  deduite?: boolean;
};
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
    if (source === "capitaux") return -r.solde;
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
      const total = section.total ? somme(source, section.prefixes, section.exclus) : detail;
      const reste = Math.round((total - detail) * 100) / 100;
      if (section.lignes.length && reste)
        lignes.push({ libelle: "Autres comptes (non ventilé)", montant: reste, niveau: "detail" });
      if (section.total) lignes.push({ libelle: section.total, montant: total, niveau: "total" });
      general += total;
      if (i === 0 && note.depreciations) {
        let dep = 0;
        for (const d of note.depreciations.lignes) {
          const v = -somme("passif", d.prefixes);
          dep += v;
          lignes.push({ libelle: d.libelle, montant: v, niveau: "detail", deduite: true });
        }
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
