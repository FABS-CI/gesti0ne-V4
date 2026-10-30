// Choix des données d'un exercice : écritures de l'ERP en priorité, balance
// importée en complément (exercice antérieur à l'ERP, soldes d'ouverture).
//
// Rappel : la clôture de l'ERP ne passe pas d'à-nouveaux ; la balance de l'ERP
// est cumulée depuis la première écriture. Les soldes d'ouverture n'existent
// donc dans l'ERP que si des écritures sont antérieures à l'exercice.

import type { BalanceRow } from "@/lib/compta-api";

export type LigneImportee = {
  compte: string;
  libelle: string | null;
  /** Solde de clôture : positif débiteur, négatif créditeur. */
  solde: number;
  mvt_debit: number | null;
  mvt_credit: number | null;
};

export type BalanceImportee = {
  lotId: string;
  fichier: string | null;
  importeLe: string;
  avecMouvements: boolean;
  lignes: LigneImportee[];
};

export type DonneesErp = {
  /** Balance cumulée à la date de clôture. */
  cumul: BalanceRow[];
  /** Balance de l'exercice. */
  periode: BalanceRow[];
  /** Balance cumulée à la veille de l'exercice. */
  ouverture: BalanceRow[];
  ecrituresPeriode: number;
  ecrituresAvant: number;
};

export type SourceDonnees = "erp" | "import" | "aucune";

export type DonneesExercice = {
  source: SourceDonnees;
  cumul: BalanceRow[];
  periode: BalanceRow[];
  ouverture: BalanceRow[];
  /** Soldes d'ouverture repris de la balance importée de l'exercice précédent. */
  ouvertureImportee: boolean;
  /** Une balance importée existe pour l'exercice mais l'ERP a des écritures : ignorée. */
  importIgnore: boolean;
  /** Soldes d'ouverture connus (ERP, import N-1 ou balance à 6 colonnes). */
  ouvertureConnue: boolean;
  /** Mouvements de l'exercice connus pour les comptes de bilan (TFT exact). */
  mouvementsConnus: boolean;
};

const arrondi = (n: number) => Math.round(n * 100) / 100;

function versBalance(compte: string, libelle: string, debit: number, credit: number): BalanceRow {
  return { compte, compte_libelle: libelle, debit, credit, solde: arrondi(debit - credit) };
}

/** Soldes de clôture importés, au format de la balance de l'ERP. */
export function soldesImportes(b: BalanceImportee): BalanceRow[] {
  return b.lignes.map((l) =>
    versBalance(l.compte, l.libelle ?? "", Math.max(l.solde, 0), Math.max(-l.solde, 0)),
  );
}

/** Mouvements de l'exercice importés ; classes 6 à 8 : le solde est le mouvement. */
function mouvementsImportes(b: BalanceImportee): BalanceRow[] {
  return b.lignes.flatMap((l) => {
    if (l.mvt_debit != null && l.mvt_credit != null)
      return [versBalance(l.compte, l.libelle ?? "", l.mvt_debit, l.mvt_credit)];
    if (/^[678]/.test(l.compte))
      return [versBalance(l.compte, l.libelle ?? "", Math.max(l.solde, 0), Math.max(-l.solde, 0))];
    return [];
  });
}

/** Ouverture déduite d'une balance à 6 colonnes : clôture − mouvements. */
function ouvertureDeduite(b: BalanceImportee): BalanceRow[] {
  return b.lignes
    .filter((l) => !/^[678]/.test(l.compte))
    .map((l) => {
      const s = l.solde - ((l.mvt_debit ?? 0) - (l.mvt_credit ?? 0));
      return versBalance(l.compte, l.libelle ?? "", Math.max(s, 0), Math.max(-s, 0));
    })
    .filter((r) => r.solde !== 0);
}

/** Additionne des balances compte par compte. */
export function fusionner(...balances: BalanceRow[][]): BalanceRow[] {
  const m = new Map<string, BalanceRow>();
  for (const r of balances.flat()) {
    const compte = r.compte.trim();
    const b = m.get(compte) ?? versBalance(compte, r.compte_libelle, 0, 0);
    b.debit += r.debit;
    b.credit += r.credit;
    b.solde = arrondi(b.debit - b.credit);
    if (!b.compte_libelle) b.compte_libelle = r.compte_libelle;
    m.set(compte, b);
  }
  return [...m.values()].sort((a, b) => a.compte.localeCompare(b.compte));
}

export function assemblerDonnees(entree: {
  erp: DonneesErp;
  importN?: BalanceImportee | null;
  importN1?: BalanceImportee | null;
}): DonneesExercice {
  const { erp, importN, importN1 } = entree;

  if (erp.ecrituresPeriode > 0) {
    // Premier exercice dans l'ERP : soldes d'ouverture repris de la balance N-1 importée.
    const reprise = erp.ecrituresAvant === 0 && !!importN1;
    const ouvertureImport = reprise ? soldesImportes(importN1!) : [];
    return {
      source: "erp",
      cumul: reprise ? fusionner(erp.cumul, ouvertureImport) : erp.cumul,
      periode: erp.periode,
      ouverture: reprise ? fusionner(erp.ouverture, ouvertureImport) : erp.ouverture,
      ouvertureImportee: reprise,
      importIgnore: !!importN,
      ouvertureConnue: erp.ecrituresAvant > 0 || reprise,
      mouvementsConnus: true,
    };
  }

  if (importN) {
    const ouverture = importN1
      ? soldesImportes(importN1)
      : importN.avecMouvements
        ? ouvertureDeduite(importN)
        : [];
    return {
      source: "import",
      cumul: soldesImportes(importN),
      periode: mouvementsImportes(importN),
      ouverture,
      ouvertureImportee: !!importN1,
      importIgnore: false,
      ouvertureConnue: !!importN1 || importN.avecMouvements,
      mouvementsConnus: importN.avecMouvements,
    };
  }

  return {
    source: "aucune",
    cumul: [],
    periode: [],
    ouverture: [],
    ouvertureImportee: false,
    importIgnore: false,
    ouvertureConnue: false,
    mouvementsConnus: false,
  };
}
