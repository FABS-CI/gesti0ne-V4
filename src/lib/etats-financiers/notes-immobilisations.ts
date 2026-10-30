// Notes 3A, 3C, 3C BIS et 3D : tableaux de mouvements des immobilisations, calculés
// depuis la balance (comptes 2x, 28x, 29x, 81x, 82x).
//
// Les comptes sont rattachés aux rubriques selon les règles du bilan
// (posteImmobilisation) : la clôture de la note 3A égale le brut de l'actif
// immobilisé, celle de la note 3C ses amortissements. L'ERP n'a pas de registre
// des immobilisations : ce que la comptabilité ne distingue pas (virements de poste
// à poste, reprises, immeubles de placement, détail des cessions) est signalé en
// hypothèse ou laissé vide, jamais mis à zéro.

import type { BalanceRow } from "@/lib/compta-api";
import { posteImmobilisation } from "@/lib/etats-financiers/syscohada";
import type { DonneesExercice } from "@/lib/etats-financiers/sources";

export type ColonneTableau = { cle: string; libelle: string };
export type LigneTableau = {
  libelle: string;
  niveau: "detail" | "total" | "general";
  /** null : montant inconnu (à compléter). */
  valeurs: Record<string, number | null>;
};
export type NoteTableau = {
  numero: string;
  titre: string;
  colonnes: ColonneTableau[];
  lignes: LigneTableau[];
  hypotheses: string[];
};

type Donnees = Pick<
  DonneesExercice,
  "ouverture" | "periode" | "cumul" | "ouvertureConnue" | "mouvementsConnus"
>;

/** Rubrique d'une note : poste d'actif, avances 25 séparées (251 incorporelles). */
function rubrique(compte: string): { cle: string; nature: "brut" | "amort" | "deprec" } | null {
  const p = posteImmobilisation(compte);
  if (!p) return null;
  if (p.poste !== "AP") return { cle: p.poste, nature: p.nature };
  const base = p.nature === "brut" ? compte : "2" + compte.slice(2);
  return { cle: base.startsWith("251") ? "AP-I" : "AP-C", nature: p.nature };
}

type Cumuls = { ouverture: number; debit: number; credit: number; cloture: number };
type Agregat = Record<string, Cumuls>;

function agreger(d: Donnees) {
  const parNature = { brut: {} as Agregat, amort: {} as Agregat, deprec: {} as Agregat };
  const ajouter = (rows: BalanceRow[], f: (c: Cumuls, r: BalanceRow) => void) => {
    for (const r of rows) {
      const ru = rubrique(r.compte);
      if (!ru) continue;
      const a = parNature[ru.nature];
      a[ru.cle] ??= { ouverture: 0, debit: 0, credit: 0, cloture: 0 };
      f(a[ru.cle], r);
    }
  };
  ajouter(d.ouverture, (c, r) => (c.ouverture += r.solde));
  ajouter(d.periode, (c, r) => {
    c.debit += r.debit;
    c.credit += r.credit;
  });
  ajouter(d.cumul, (c, r) => (c.cloture += r.solde));
  return parNature;
}

const somme = (rows: BalanceRow[], prefixes: string[]) =>
  rows
    .filter((r) => prefixes.some((p) => r.compte.trim().startsWith(p)))
    .reduce((s, r) => s + r.solde, 0);

const arrondi = (n: number) => Math.round(n) || 0;

type Rubrique = { libelle: string; cle: string | null };
type Bloc = { total?: string; rubriques: Rubrique[] };

/** Lignes détaillées + totaux ; un total est inconnu si l'une de ses lignes l'est. */
function construire(
  blocs: Bloc[],
  general: string,
  colonnes: string[],
  valeur: (cle: string | null, col: string) => number | null,
): LigneTableau[] {
  const lignes: LigneTableau[] = [];
  const totalGeneral: Record<string, number | null> = Object.fromEntries(
    colonnes.map((c) => [c, 0]),
  );
  for (const b of blocs) {
    const total: Record<string, number | null> = Object.fromEntries(colonnes.map((c) => [c, 0]));
    for (const r of b.rubriques) {
      const valeurs = Object.fromEntries(colonnes.map((c) => [c, valeur(r.cle, c)]));
      lignes.push({ libelle: r.libelle, niveau: "detail", valeurs });
      for (const c of colonnes) {
        const v = valeurs[c];
        total[c] = total[c] == null || v == null ? null : total[c]! + v;
      }
    }
    for (const c of colonnes)
      totalGeneral[c] =
        totalGeneral[c] == null || total[c] == null ? null : totalGeneral[c]! + total[c]!;
    if (b.total) lignes.push({ libelle: b.total, niveau: "total", valeurs: total });
  }
  lignes.push({ libelle: general, niveau: "general", valeurs: totalGeneral });
  return lignes;
}

// Rubriques, avec les libellés exacts des feuilles du modèle DGI.
const INCORPORELLES = (brevets: string): Rubrique[] => [
  { libelle: "Frais de développement et de prospection", cle: "AE" },
  { libelle: brevets, cle: "AF" },
  { libelle: "Fonds commercial et droit au bail", cle: "AG" },
  { libelle: "Autres immobilisations incorporelles", cle: "AH" },
];
const CORPORELLES: Rubrique[] = [
  { libelle: "Terrains hors immeuble de placement", cle: "AJ" },
  { libelle: "Terrains - immeuble de placement", cle: null },
  { libelle: "Bâtiments hors immeuble de placement", cle: "AK" },
  { libelle: "Bâtiments - immeuble de placement", cle: null },
  { libelle: "Aménagements, agencements et installations", cle: "AL" },
  { libelle: "Matériel, mobilier et actifs biologiques", cle: "AM" },
  { libelle: "Matériel de transport", cle: "AN" },
];

const H_VIREMENTS =
  "virements de poste à poste non distingués par la comptabilité : compris dans les acquisitions et les cessions";
const H_PLACEMENT =
  "immeubles de placement non distingués : terrains et bâtiments classés « hors immeuble de placement »";
const H_MOUVEMENTS =
  "mouvements de l'exercice inconnus (balance importée sans mouvements) : colonnes de mouvements laissées vides";
const H_OUVERTURE = "soldes d'ouverture inconnus : colonne d'ouverture laissée vide";

export function calculerNotesImmobilisations(d: Donnees): NoteTableau[] {
  const a = agreger(d);
  const ouv = d.ouvertureConnue;
  const mvt = d.mouvementsConnus;
  const placement = ["AJ", "AK"].some(
    (k) => a.brut[k] && (a.brut[k].ouverture || a.brut[k].cloture || a.brut[k].debit),
  );
  const communes = (h: string[]) => [
    ...(!ouv ? [H_OUVERTURE] : []),
    ...(!mvt ? [H_MOUVEMENTS] : []),
    ...h,
  ];

  // ─── 3A : immobilisations brutes ─────────────────────────────────────────
  const brut = (cle: string | null, col: string): number | null => {
    // Ligne sans compte (immeubles de placement) : 0, les montants étant classés hors placement.
    const c = (cle && a.brut[cle]) || { ouverture: 0, debit: 0, credit: 0, cloture: 0 };
    if (col === "ouverture") return ouv ? arrondi(c.ouverture) : null;
    if (col === "acquisitions") return mvt ? arrondi(c.debit) : null;
    if (col === "cessions") return mvt ? arrondi(c.credit) : null;
    if (col === "cloture") return arrondi(c.cloture);
    return null; // virements, réévaluations : non distingués
  };
  const acquisOuCessions = Object.values(a.brut).some((c) => c.debit || c.credit);
  const n3a: NoteTableau = {
    numero: "3A",
    titre: "Immobilisations (brutes)",
    colonnes: [
      { cle: "ouverture", libelle: "Montant brut à l'ouverture" },
      { cle: "acquisitions", libelle: "Acquisitions, apports, créations" },
      { cle: "virements_plus", libelle: "Virements de poste à poste (+)" },
      { cle: "reevaluation", libelle: "Suite à une réévaluation" },
      { cle: "cessions", libelle: "Cessions, scissions, hors service" },
      { cle: "virements_moins", libelle: "Virements de poste à poste (-)" },
      { cle: "cloture", libelle: "Montant brut à la clôture" },
    ],
    lignes: [],
    hypotheses: communes([
      ...(mvt && acquisOuCessions ? [H_VIREMENTS] : []),
      ...(placement ? [H_PLACEMENT] : []),
    ]),
  };
  n3a.lignes = construire(
    [
      {
        total: "IMMOBILISATIONS INCORPORELLES",
        rubriques: INCORPORELLES("Brevets, licences, logiciels, et droits similaires"),
      },
      { total: "IMMOBILISATIONS CORPORELLES", rubriques: CORPORELLES },
      {
        total: "AVANCES ET ACOMPTES VERSES SUR IMMOBILISATIONS",
        rubriques: [
          { libelle: "Avances et acomptes sur immobilisations incorporelles", cle: "AP-I" },
          { libelle: "Avances et acomptes sur immobilisations corporelles", cle: "AP-C" },
        ],
      },
      {
        total: "IMMOBILISATIONS FINANCIERES",
        rubriques: [
          { libelle: "Titres de participation", cle: "AR" },
          { libelle: "Autres immobilisations financières", cle: "AS" },
        ],
      },
    ],
    "TOTAL GENERAL",
    n3a.colonnes.map((c) => c.cle),
    brut,
  );

  // ─── 3C et 3C BIS : amortissements et dépréciations ──────────────────────
  // Comptes 28x / 29x créditeurs : cumul positif ; dotations au crédit, sorties au débit.
  const cumulNegatif = (ag: Agregat) => (cle: string | null, col: string) => {
    const c = (cle && ag[cle]) || { ouverture: 0, debit: 0, credit: 0, cloture: 0 };
    if (col === "ouverture") return ouv ? arrondi(-c.ouverture) : null;
    if (col === "dotations") return mvt ? arrondi(c.credit) : null;
    if (col === "diminutions") return mvt ? arrondi(c.debit) : null;
    if (col === "cloture") return arrondi(-c.cloture);
    return null;
  };
  const blocsAmort = [
    {
      total: "IMMOBILISATIONS INCORPORELLES",
      rubriques: INCORPORELLES("Brevets, licences, logiciels et droits similaires"),
    },
    { total: "IMMOBILISATIONS CORPORELLES", rubriques: CORPORELLES },
  ];
  const sorties = (ag: Agregat) => Object.values(ag).some((c) => c.debit);
  const n3c: NoteTableau = {
    numero: "3C",
    titre: "Immobilisations (amortissements)",
    colonnes: [
      { cle: "ouverture", libelle: "Amortissements cumulés à l'ouverture" },
      { cle: "dotations", libelle: "Dotations de l'exercice" },
      { cle: "diminutions", libelle: "Relatifs aux éléments sortis de l'actif" },
      { cle: "reprises", libelle: "Reprises d'amortissements" },
      { cle: "virements", libelle: "Virements de poste à poste" },
      { cle: "cloture", libelle: "Cumul à la clôture" },
    ],
    lignes: [],
    hypotheses: communes([
      ...(mvt && sorties(a.amort)
        ? [
            "reprises d'amortissements non distinguées des sorties d'actif : toutes classées « éléments sortis de l'actif »",
          ]
        : []),
      ...(placement ? [H_PLACEMENT] : []),
    ]),
  };
  n3c.lignes = construire(
    blocsAmort,
    "TOTAL GENERAL",
    n3c.colonnes.map((c) => c.cle),
    cumulNegatif(a.amort),
  );
  const n3cBis: NoteTableau = {
    numero: "3C BIS",
    titre: "Immobilisations (dépréciations)",
    colonnes: [
      { cle: "ouverture", libelle: "Dépréciations cumulées à l'ouverture" },
      { cle: "dotations", libelle: "Dotations de l'exercice" },
      { cle: "diminutions", libelle: "Reprises de l'exercice" },
      { cle: "cloture", libelle: "Cumul à la clôture" },
    ],
    lignes: [],
    hypotheses: communes(placement ? [H_PLACEMENT] : []),
  };
  n3cBis.lignes = construire(
    blocsAmort,
    "TOTAL GENERAL",
    n3cBis.colonnes.map((c) => c.cle),
    cumulNegatif(a.deprec),
  );

  // ─── 3D : plus et moins-values de cession ────────────────────────────────
  // Brut sorti (crédit 2x) et amortissements des éléments sortis (débit 28x) par
  // rubrique ; prix de cession (82x) par catégorie seulement, comme le modèle.
  const prix = { incorp: ["821"], corp: ["822"], fin: ["826"] } as const;
  const vncCompte = { incorp: ["811"], corp: ["812"], fin: ["816"] } as const;
  const n3dHyp: string[] = [];
  const cession = (cle: string | null, col: string): number | null => {
    if (!mvt || cle == null) return null;
    const b = a.brut[cle]?.credit ?? 0;
    const am = a.amort[cle]?.debit ?? 0;
    if (col === "brut") return arrondi(b);
    if (col === "amort") return arrondi(am);
    if (col === "vnc") return arrondi(b - am);
    return null; // prix et plus-value : par catégorie
  };
  const blocs3d: Array<Bloc & { total: string; categorie: keyof typeof prix }> = [
    {
      categorie: "incorp",
      total: "IMMOBILISATIONS INCORPORELLES",
      rubriques: INCORPORELLES("Brevets, licences, logiciels et droits similaires"),
    },
    {
      categorie: "corp",
      total: "IMMOBILISATIONS CORPORELLES",
      rubriques: [
        { libelle: "Terrains", cle: "AJ" },
        { libelle: "Bâtiments", cle: "AK" },
        { libelle: "Aménagements, agencements et installations", cle: "AL" },
        { libelle: "Matériel, mobilier et actifs biologiques", cle: "AM" },
        { libelle: "Matériel de transport", cle: "AN" },
      ],
    },
    {
      categorie: "fin",
      total: "IMMOBILISATIONS FINANCIERES",
      rubriques: [
        { libelle: "Titres de participations", cle: "AR" },
        { libelle: "Autres immobilisations financières", cle: "AS" },
      ],
    },
  ];
  const cols3d = ["brut", "amort", "vnc", "prix", "plus_value"];
  const lignes3d = construire(blocs3d, "TOTAL GENERAL", cols3d, cession);
  // Prix de cession et plus-value sur les lignes de total de catégorie.
  let prixTotal: number | null = 0;
  for (const b of blocs3d) {
    const total = lignes3d.find((l) => l.libelle === b.total && l.niveau === "total")!;
    const p = mvt ? arrondi(-somme(d.periode, [...prix[b.categorie]])) : null;
    total.valeurs.prix = p;
    total.valeurs.plus_value =
      p == null || total.valeurs.vnc == null ? null : p - total.valeurs.vnc;
    prixTotal = prixTotal == null || p == null ? null : prixTotal + p;
    // Contrôle : la VNC des éléments sortis doit égaler le compte 81x de la catégorie.
    if (mvt) {
      const vnc81 = arrondi(somme(d.periode, [...vncCompte[b.categorie]]));
      if (total.valeurs.vnc !== vnc81)
        n3dHyp.push(
          `${b.total.toLowerCase()} : valeur nette des éléments sortis (${total.valeurs.vnc}) différente du compte ${vncCompte[b.categorie][0]} (${vnc81}) ; des virements de poste à poste ou des mises au rebut sont probables, détailler les cessions par bien`,
        );
    }
  }
  const general3d = lignes3d.at(-1)!;
  general3d.valeurs.prix = prixTotal;
  general3d.valeurs.plus_value =
    prixTotal == null || general3d.valeurs.vnc == null ? null : prixTotal - general3d.valeurs.vnc;
  for (const l of lignes3d) if (l.niveau === "detail") l.valeurs.plus_value = null;
  const n3d: NoteTableau = {
    numero: "3D",
    titre: "Immobilisations (plus-values et moins-values de cession)",
    colonnes: [
      { cle: "brut", libelle: "Montant brut" },
      { cle: "amort", libelle: "Amortissements pratiqués" },
      { cle: "vnc", libelle: "Valeur comptable nette" },
      { cle: "prix", libelle: "Prix de cession" },
      { cle: "plus_value", libelle: "Plus-value ou moins-value" },
    ],
    lignes: lignes3d,
    hypotheses: communes(n3dHyp),
  };

  return [n3a, n3c, n3cBis, n3d];
}
