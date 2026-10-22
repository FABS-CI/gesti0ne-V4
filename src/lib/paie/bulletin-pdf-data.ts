// Construit les données du PDF bulletin uniquement à partir des lignes enregistrées
// (bulletin_lignes) : aucun recalcul, pour qu'un bulletin émis ne change jamais.
import type { BulletinCIData, BulletinLigne, BulletinEntreprise, BulletinCumulsAnnuels } from "@/lib/pdf/bulletinPaieCI";

export interface LigneStockee {
  numero_rubrique: string | null;
  designation: string | null;
  libelle: string | null;
  nombre: number | null;
  base: number | null;
  taux: number | null;
  gain: number;
  retenue: number;
  bloc: string | null;
  ordre: number;
}

export interface BulletinStocke {
  bulletin_id: string;
  reference: string | null;
  employe_nom: string | null;
  periode: string | null;
  date_debut: string | null;
  date_fin: string | null;
  date_paiement: string | null;
  date_etablissement: string | null;
  created_at: string;
  mode_paiement: string | null;
  parts: number | null;
  brut_imposable: number | null;
  salaire_brut: number | null;
  retenues: number | null;
  net_a_payer: number | null;
  salaire_net: number | null;
  total_indemnites_non_imposables: number | null;
  total_autres_retenues: number | null;
  cout_salarial: number | null;
}

export interface EmployeInfo {
  matricule?: string | null;
  prenoms?: string | null;
  poste?: string | null;
  categorie?: string | null;
  numero_cnps?: string | null;
  date_embauche?: string | null;
  departement?: string | null;
  adresse?: string | null;
}

/** Bulletin de l'année civile (mois courant inclus) servant aux cumuls. */
export interface BulletinCumul {
  brut_imposable: number | null;
  jours_travailles: number | null;
  lignes: Array<Pick<LigneStockee, "numero_rubrique" | "retenue">>;
}

/** Cumuls annuels calculés uniquement depuis les bulletins enregistrés. */
export function calculerCumuls(bulletins: BulletinCumul[]): BulletinCumulsAnnuels {
  const sum = (code: string) =>
    bulletins.reduce(
      (s, b) => s + b.lignes.filter((l) => l.numero_rubrique === code).reduce((t, l) => t + n(l.retenue), 0),
      0,
    );
  const cr = sum("469");
  const cn = sum("420");
  return {
    cr,
    cn,
    crn: cr + cn,
    its: sum("401") + sum("413"),
    igr: sum("431"),
    brutImposable: bulletins.reduce((s, b) => s + n(b.brut_imposable), 0),
    jrsTravailles: bulletins.reduce((s, b) => s + n(b.jours_travailles), 0),
  };
}

/** Nom + prénoms, sans doubler les prénoms déjà présents dans le nom. */
export function nomEtPrenoms(nom: string | null | undefined, prenoms: string | null | undefined): string {
  const a = (nom ?? "").trim();
  const p = (prenoms ?? "").trim();
  if (!p || a.toLowerCase().includes(p.toLowerCase())) return a;
  return a ? `${a} ${p}` : p;
}

const n = (v: number | null | undefined) => Number(v ?? 0) || 0;

export function lignesPourPdf(lignes: LigneStockee[]) {
  const sorted = [...lignes].sort((a, b) => a.ordre - b.ordre);
  // Une retenue garde `retenue: 0` (ex. ITS annulé par la RICF) pour rester
  // dans le bloc des retenues ; un gain n'a pas de champ retenue.
  const toLigne = (l0: LigneStockee, imposable: boolean): BulletinLigne => {
    // Anciens bulletins : affichage seul, montants stockés inchangés.
    const l: LigneStockee =
      l0.numero_rubrique === "776"
        ? { ...l0, numero_rubrique: "470", designation: "CMU (Couverture Maladie Univ.)", bloc: "retenue" }
        : l0.numero_rubrique === "413"
          ? { ...l0, numero_rubrique: "401" }
          : l0;
    const estRetenue = l.bloc === "retenue" || (n(l.retenue) !== 0 && n(l.gain) === 0);
    return {
      code: l.numero_rubrique ?? undefined,
      libelle: l.designation ?? l.libelle ?? "",
      nbre: l.nombre,
      base: l.base,
      taux: l.taux,
      gain: estRetenue ? null : n(l.gain),
      retenue: estRetenue ? n(l.retenue) : null,
      imposable,
    };
  };
  return {
    lignes: sorted
      .filter((l) => l.bloc !== "patronal")
      .map((l) => toLigne(l, l.bloc === "imposable" || l.bloc === "retenue" || l.numero_rubrique === "776")),
    patronales: sorted.filter((l) => l.bloc === "patronal").map((l) => toLigne(l, true)),
  };
}

export function construireDonneesPdf(
  b: BulletinStocke,
  lignes: LigneStockee[],
  emp: EmployeInfo | null,
  entreprise: BulletinEntreprise,
  cumuls?: BulletinCumulsAnnuels,
): BulletinCIData {
  const { lignes: ls, patronales } = lignesPourPdf(lignes);
  const totalGains = ls.reduce((s, l) => s + n(l.gain), 0);
  const totalRetenues = ls.reduce((s, l) => s + n(l.retenue), 0);
  const brutImpo = n(b.brut_imposable ?? b.salaire_brut);
  const net = n(b.net_a_payer ?? b.salaire_net);
  return {
    reference: b.reference ?? `BP|${b.bulletin_id.slice(0, 8)}`,
    entreprise,
    salarie: {
      matricule: emp?.matricule ?? "—",
      nomComplet: nomEtPrenoms(b.employe_nom, emp?.prenoms),
      fonction: emp?.poste ?? undefined,
      categorie: emp?.categorie ?? undefined,
      departement: emp?.departement ?? undefined,
      numCnps: emp?.numero_cnps ?? undefined,
      dateEmbauche: emp?.date_embauche ?? undefined,
      adresse: emp?.adresse ?? undefined,
      parts: b.parts ?? undefined,
    },
    periode: {
      periode: b.periode ?? "",
      mois: b.periode ?? undefined,
      du: b.date_debut ?? undefined,
      au: b.date_fin ?? undefined,
      dateEdition: b.date_etablissement ?? b.created_at,
    },
    lignes: ls,
    patronales,
    totaux: {
      totalGains,
      totalRetenues,
      salaireBrut: brutImpo,
      salaireImposable: brutImpo,
      netAPayer: net,
      totalIndemnitesNonImpo: n(b.total_indemnites_non_imposables),
      totalAutresRetenues: n(b.total_autres_retenues),
      coutSalarial: b.cout_salarial ?? undefined,
    },
    cumuls,
    paiement: { date: b.date_paiement ?? undefined, mode: b.mode_paiement ?? undefined },
  };
}
