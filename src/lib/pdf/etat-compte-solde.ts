import { formatFCFA } from "@/lib/format";

// Calcul partagé (route "États de compte clients" + PDF builder) pour garantir
// que le tableau et le PDF affichent EXACTEMENT les mêmes Débit, Crédit et Solde
// pour un client donné et une période donnée.
//
// Mode debug : activer via
//   localStorage.setItem("fabs.debug.etat-compte", "1")
// ou via la variable d'environnement VITE_DEBUG_ETAT_COMPTE=1.

export type MouvementLigne = {
  date: string;
  type: "Report" | "Facture" | "Paiement" | "Avoir";
  reference: string;
  debit?: number;
  credit?: number;
  soldeProgressif?: number;
};

export type RawInputs = {
  clientId: string;
  /** Bornes de l'exercice (incluses). null/undefined = pas de filtre période. */
  dateDebut?: string | null;
  dateFin?: string | null;
  /** Solde d'ouverture explicite (table soldes_ouverture_clients). */
  soldeOuvertureRow?: number | null;
  factures: Array<{
    reference?: string | null;
    date_facture: string;
    montant_total: number | null;
  }>;
  paiements: Array<{
    reference?: string | null;
    date_paiement: string;
    montant: number | null;
    statut?: string | null;
  }>;
  avoirs: Array<{
    reference?: string | null;
    date_retour: string;
    montant: number | null;
    statut?: string | null;
  }>;
};

export type SoldeDebug = {
  clientId: string;
  filtres: {
    statutPaiements: "valide";
    statutAvoirs: "valide";
    dateDebut: string | null;
    dateFin: string | null;
  };
  soldeOuvertureRow: number;
  reportAnterieur: number;
  soldeOuverture: number;
  compteurs: {
    facturesBrutes: number;
    facturesRetenues: number;
    paiementsBruts: number;
    paiementsValidesPeriode: number;
    avoirsBruts: number;
    avoirsValidesPeriode: number;
  };
  totalDebit: number;
  totalCredit: number;
  solde: number;
};

export type SoldeResultat = {
  soldeOuverture: number;
  lignes: MouvementLigne[];
  totalDebit: number;
  /** Somme des affectations de paiements validés uniquement. */
  totalPaiement: number;
  /** Somme des retours financièrement validés uniquement. */
  totalRetours: number;
  /** Compatibilité interne : paiements + retours. */
  totalCredit: number;
  solde: number;
  isEmpty: boolean;
  emptyExplanation?: string;
  debug: SoldeDebug;
};

/**
 * Un retour ne réduit le solde client qu'après validation financière
 * (comptabilité). Une demande en attente ou seulement réceptionnée ne compte pas.
 */
export const retourFinancierValide = (statut?: string | null) =>
  !!statut && ["valide", "accepte", "valide_compta", "cloture"].includes(statut.toLowerCase());
const avoirEstValide = retourFinancierValide;

const inRange = (iso: string, debut?: string | null, fin?: string | null) => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return false;
  if (debut && t < new Date(debut).getTime()) return false;
  if (fin && t > new Date(fin).getTime()) return false;
  return true;
};

function debugEnabled(): boolean {
  try {
    if (
      typeof localStorage !== "undefined" &&
      localStorage.getItem("fabs.debug.etat-compte") === "1"
    )
      return true;
  } catch {
    /* SSR */
  }
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  return env?.VITE_DEBUG_ETAT_COMPTE === "1";
}

/**
 * Pure — pas d'accès I/O. Utilisée par la route (agrégat multi-clients) ET
 * par le builder PDF pour garantir la parité tableau ↔ PDF.
 */
export function computeSoldeClient(input: RawInputs): SoldeResultat {
  const { dateDebut, dateFin } = input;
  const soldeOuvertureRow = Number(input.soldeOuvertureRow ?? 0);

  // Report antérieur = mouvements valides AVANT dateDebut
  let reportAnterieur = 0;
  if (dateDebut) {
    const cutoff = new Date(dateDebut).getTime();
    for (const f of input.factures) {
      if (!f.date_facture) continue;
      const t = new Date(f.date_facture).getTime();
      if (t < cutoff) reportAnterieur += Number(f.montant_total ?? 0);
    }
    for (const p of input.paiements) {
      if (p.statut && p.statut !== "valide") continue;
      if (!p.date_paiement) continue;
      const t = new Date(p.date_paiement).getTime();
      if (t < cutoff) reportAnterieur -= Number(p.montant ?? 0);
    }
    for (const a of input.avoirs) {
      if (!avoirEstValide(a.statut)) continue;
      if (!a.date_retour) continue;
      const t = new Date(a.date_retour).getTime();
      if (t < cutoff) reportAnterieur -= Number(a.montant ?? 0);
    }
  }

  const soldeOuverture = soldeOuvertureRow + reportAnterieur;

  // Mouvements de la période
  const lignes: MouvementLigne[] = [];
  let facturesRetenues = 0;
  let paiementsValidesPeriode = 0;
  let avoirsValidesPeriode = 0;

  for (const f of input.factures) {
    if (!f.date_facture) continue;
    if (!inRange(f.date_facture, dateDebut, dateFin)) continue;
    facturesRetenues += 1;
    lignes.push({
      date: f.date_facture,
      type: "Facture",
      reference: f.reference ?? "",
      debit: Number(f.montant_total ?? 0),
    });
  }
  for (const p of input.paiements) {
    if (p.statut && p.statut !== "valide") continue;
    if (!p.date_paiement) continue;
    if (!inRange(p.date_paiement, dateDebut, dateFin)) continue;
    paiementsValidesPeriode += 1;
    lignes.push({
      date: p.date_paiement,
      type: "Paiement",
      reference: p.reference ?? "",
      credit: Number(p.montant ?? 0),
    });
  }
  for (const a of input.avoirs) {
    if (!avoirEstValide(a.statut)) continue;
    if (!a.date_retour) continue;
    if (!inRange(a.date_retour, dateDebut, dateFin)) continue;
    avoirsValidesPeriode += 1;
    lignes.push({
      date: a.date_retour,
      type: "Avoir",
      reference: a.reference ?? "",
      credit: Number(a.montant ?? 0),
    });
  }

  // Tri chronologique ; à date égale : facture, puis paiement, puis retour,
  // départagés par référence (ex. RET-…-002 avant RET-…-003).
  const ordreType: Record<MouvementLigne["type"], number> = { Report: 0, Facture: 1, Paiement: 2, Avoir: 3 };
  lignes.sort(
    (a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime() ||
      ordreType[a.type] - ordreType[b.type] ||
      a.reference.localeCompare(b.reference, "fr", { numeric: true }),
  );

  let totalDebit = 0;
  let totalPaiement = 0;
  let totalRetours = 0;
  let currentSolde = soldeOuverture;
  for (const l of lignes) {
    const debit = Number(l.debit ?? 0);
    const credit = Number(l.credit ?? 0);
    totalDebit += debit;
    if (l.type === "Paiement") totalPaiement += credit;
    if (l.type === "Avoir") totalRetours += credit;
    currentSolde = currentSolde + debit - credit;
    l.soldeProgressif = currentSolde;
  }
  const totalCredit = totalPaiement + totalRetours;
  const solde = currentSolde;

  const isEmpty = lignes.length === 0;
  const emptyExplanation = isEmpty
    ? [
        "Aucun mouvement valide sur la période.",
        `Solde d'ouverture (report à-nouveau) = ${formatFCFA(soldeOuvertureRow, false)} + report antérieur ${formatFCFA(reportAnterieur, false)} = ${formatFCFA(soldeOuverture, false)}.`,
        `Total impayé (FCFA) = Solde d'ouverture + Débits (0) − Crédits (0) = ${formatFCFA(Math.abs(solde))}.`,
        "Filtres appliqués : paiements/avoirs avec statut = « valide » uniquement, dans les bornes de l'exercice consulté.",
      ].join(" ")
    : undefined;

  const debug: SoldeDebug = {
    clientId: input.clientId,
    filtres: {
      statutPaiements: "valide",
      statutAvoirs: "valide",
      dateDebut: dateDebut ?? null,
      dateFin: dateFin ?? null,
    },
    soldeOuvertureRow,
    reportAnterieur,
    soldeOuverture,
    compteurs: {
      facturesBrutes: input.factures.length,
      facturesRetenues,
      paiementsBruts: input.paiements.length,
      paiementsValidesPeriode,
      avoirsBruts: input.avoirs.length,
      avoirsValidesPeriode,
    },
    totalDebit,
    totalCredit,
    solde,
  };

  if (debugEnabled()) {
    // eslint-disable-next-line no-console
    console.debug("[etat-compte]", debug);
  }

  return {
    soldeOuverture,
    lignes,
    totalDebit,
    totalPaiement,
    totalRetours,
    totalCredit,
    solde,
    isEmpty,
    emptyExplanation,
    debug,
  };
}
