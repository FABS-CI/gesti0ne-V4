// Lecture d'une balance comptable exportée d'un autre logiciel (Excel ou CSV),
// déjà convertie en lignes de cellules (SheetJS, `header: 1`).
//
// Formats reconnus d'après les intitulés de colonnes :
//   - balance à 6 colonnes : mouvements débit / crédit + soldes débit / crédit
//     (les soldes d'ouverture se déduisent : clôture − mouvements) ;
//   - soldes débit / crédit, ou une colonne « solde » signée ;
//   - débit / crédit seuls : le solde de clôture vaut débit − crédit.
// Rien n'est deviné : un fichier sans colonne de compte ou de montants est refusé.

import type { LigneImportee } from "@/lib/etats-financiers/sources";

export type ResultatImport = {
  lignes: LigneImportee[];
  avecMouvements: boolean;
  erreurs: string[];
  /** Intitulés des colonnes retenues, pour affichage. */
  colonnes: string[];
};

const normaliser = (v: unknown) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Montant au format français ou anglais : « 1 234 567,50 », « (1 200) », « -300 ». */
export function lireMontant(v: unknown): number | null {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  // \s couvre aussi les espaces insécables des tableurs français.
  let s = String(v).replace(/\s/g, "");
  const negatif = /^\(.*\)$/.test(s);
  s = s.replace(/[()]/g, "");
  if (s === "" || s === "-") return 0;
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negatif ? -n : n;
}

type Colonnes = {
  compte: number;
  libelle?: number;
  soldeD?: number;
  soldeC?: number;
  solde?: number;
  mvtD?: number;
  mvtC?: number;
  debit?: number;
  credit?: number;
};

function reperer(entetes: string[]): Colonnes | null {
  const idx = (pred: (h: string) => boolean) => {
    const i = entetes.findIndex(pred);
    return i >= 0 ? i : undefined;
  };
  const compte = idx(
    (h) => /\bcompte\b|^n ?compte|^numero$|^num$/.test(h) && !/libelle|intitule/.test(h),
  );
  if (compte === undefined) return null;
  const debit = (h: string) => /\bdebit/.test(h);
  const credit = (h: string) => /\bcredit/.test(h);
  const mouvement = (h: string) => /mouvement|periode|exercice|mvt/.test(h);
  const ouverture = (h: string) => /ouverture|initial|anterieur|a nouveau|report/.test(h);
  return {
    compte,
    libelle: idx((h) => /libelle|intitule|designation/.test(h)),
    soldeD: idx((h) => /solde/.test(h) && debit(h) && !ouverture(h)),
    soldeC: idx((h) => /solde/.test(h) && credit(h) && !ouverture(h)),
    solde: idx((h) => /^solde( final| de cloture| cloture)?$/.test(h)),
    mvtD: idx((h) => mouvement(h) && debit(h) && !/solde/.test(h)),
    mvtC: idx((h) => mouvement(h) && credit(h) && !/solde/.test(h)),
    debit: idx((h) => debit(h) && !/solde/.test(h) && !mouvement(h) && !ouverture(h)),
    credit: idx((h) => credit(h) && !/solde/.test(h) && !mouvement(h) && !ouverture(h)),
  };
}

export function lireBalance(cellules: unknown[][]): ResultatImport {
  const erreurs: string[] = [];
  const ligneEntete = cellules.findIndex((row) => reperer(row.map(normaliser)) !== null);
  if (ligneEntete < 0)
    return {
      lignes: [],
      avecMouvements: false,
      erreurs: ["Colonne « Compte » introuvable."],
      colonnes: [],
    };
  const entetes = cellules[ligneEntete].map((v) => String(v ?? "").trim());
  const col = reperer(entetes.map(normaliser))!;

  const modeSoldes = col.soldeD !== undefined && col.soldeC !== undefined;
  const modeSolde = !modeSoldes && col.solde !== undefined;
  const modeDebitCredit =
    !modeSoldes && !modeSolde && col.debit !== undefined && col.credit !== undefined;
  if (!modeSoldes && !modeSolde && !modeDebitCredit)
    return {
      lignes: [],
      avecMouvements: false,
      erreurs: [
        "Colonnes de montants introuvables (soldes débit / crédit, solde, ou débit / crédit).",
      ],
      colonnes: [],
    };
  const avecMouvements = col.mvtD !== undefined && col.mvtC !== undefined;

  const retenues = [col.compte, col.libelle, col.soldeD, col.soldeC, col.solde, col.mvtD, col.mvtC]
    .concat(modeDebitCredit ? [col.debit, col.credit] : [])
    .filter((i): i is number => i !== undefined)
    .map((i) => entetes[i]);

  const lignes: LigneImportee[] = [];
  const vus = new Set<string>();
  cellules.slice(ligneEntete + 1).forEach((row, i) => {
    const numero = String(row[col.compte] ?? "").replace(/[\s.]/g, "");
    // Lignes de total, de classe ou vides : sans numéro de compte.
    if (!/^[1-9]\d*$/.test(numero)) return;
    const n = ligneEntete + i + 2;
    const montant = (c?: number) => (c === undefined ? 0 : lireMontant(row[c]));
    const valeurs = modeSoldes
      ? [montant(col.soldeD), montant(col.soldeC)]
      : modeSolde
        ? [montant(col.solde), 0]
        : [montant(col.debit), montant(col.credit)];
    const mvt = avecMouvements ? [montant(col.mvtD), montant(col.mvtC)] : [0, 0];
    if ([...valeurs, ...mvt].some((v) => v === null)) {
      erreurs.push(`Ligne ${n} (compte ${numero}) : montant illisible.`);
      return;
    }
    if (vus.has(numero)) {
      erreurs.push(`Ligne ${n} : compte ${numero} en double.`);
      return;
    }
    vus.add(numero);
    const solde = Math.round(((valeurs[0] as number) - (valeurs[1] as number)) * 100) / 100;
    if (!solde && !mvt[0] && !mvt[1]) return;
    lignes.push({
      compte: numero,
      libelle: col.libelle !== undefined ? String(row[col.libelle] ?? "").trim() || null : null,
      solde,
      mvt_debit: avecMouvements ? (mvt[0] as number) : null,
      mvt_credit: avecMouvements ? (mvt[1] as number) : null,
    });
  });

  if (!lignes.length && !erreurs.length) erreurs.push("Aucune ligne de compte avec un montant.");
  const debit = lignes.reduce((s, l) => s + Math.max(l.solde, 0), 0);
  const credit = lignes.reduce((s, l) => s + Math.max(-l.solde, 0), 0);
  if (Math.abs(debit - credit) > 1)
    erreurs.push(
      `Balance déséquilibrée : soldes débiteurs ${Math.round(debit)} ≠ soldes créditeurs ${Math.round(credit)}.`,
    );
  return { lignes, avecMouvements, erreurs, colonnes: retenues };
}
