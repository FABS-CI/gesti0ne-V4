// Construit les données du PDF bulletin uniquement à partir des lignes enregistrées
// (bulletin_lignes) : aucun recalcul, pour qu'un bulletin émis ne change jamais.
import type { BulletinCIData, BulletinLigne, BulletinEntreprise } from "@/lib/pdf/bulletinPaieCI";

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
  poste?: string | null;
  categorie?: string | null;
  numero_cnps?: string | null;
  date_embauche?: string | null;
  departement?: string | null;
}

const n = (v: number | null | undefined) => Number(v ?? 0) || 0;

export function lignesPourPdf(lignes: LigneStockee[]) {
  const sorted = [...lignes].sort((a, b) => a.ordre - b.ordre);
  const toLigne = (l: LigneStockee, imposable: boolean): BulletinLigne => ({
    code: l.numero_rubrique ?? undefined,
    libelle: l.designation ?? l.libelle ?? "",
    nbre: l.nombre,
    base: l.base,
    taux: l.taux,
    gain: n(l.gain),
    retenue: n(l.retenue),
    imposable,
  });
  return {
    lignes: sorted
      .filter((l) => l.bloc !== "patronal")
      .map((l) => toLigne(l, l.bloc === "imposable" || l.bloc === "retenue")),
    patronales: sorted.filter((l) => l.bloc === "patronal").map((l) => toLigne(l, true)),
  };
}

export function construireDonneesPdf(
  b: BulletinStocke,
  lignes: LigneStockee[],
  emp: EmployeInfo | null,
  entreprise: BulletinEntreprise,
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
      nomComplet: b.employe_nom ?? "",
      fonction: emp?.poste ?? undefined,
      categorie: emp?.categorie ?? undefined,
      departement: emp?.departement ?? undefined,
      numCnps: emp?.numero_cnps ?? undefined,
      dateEmbauche: emp?.date_embauche ?? undefined,
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
    paiement: { date: b.date_paiement ?? undefined, mode: b.mode_paiement ?? undefined },
  };
}
