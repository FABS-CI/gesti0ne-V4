// @vitest-environment node
// Indicateurs du tableau de bord comptable (migration 0114), sur un vrai PostgreSQL
// (PGlite). Scénario : capital apporté en 2024, activité 2025 (vente, encaissement,
// achat, paie, produit hors activités ordinaires, brouillon, écriture annulée).

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  SOCLE_SUPABASE,
  TABLES_COMPTA,
  TECHNIQUE,
  UTILISATEUR,
  fonctionMigration,
  migration,
} from "@/test/pg-migrations";

let db: PGlite;

type Tableau = {
  ecritures: { total: number; validees: number; brouillons: number; annulees: number };
  mouvements: {
    debit: number;
    credit: number;
    soldes_debiteurs: number;
    soldes_crediteurs: number;
    comptes_mouvementes: number;
  };
  resultat: {
    chiffre_affaires: number;
    produits: number;
    charges: number;
    hao: number;
    resultat: number;
  };
  situation: {
    tresorerie: number;
    creances_clients: number;
    dettes_fournisseurs: number;
    dettes_sociales_fiscales: number;
  };
  mensuel: { mois: string; chiffre_affaires: number; charges: number; resultat: number }[];
  charges_par_compte: { compte: string; libelle: string; montant: number }[];
};

const ecriture = (
  ref: string,
  date: string,
  lignes: [string, number, number][],
  extra = "",
  statut = "valide",
) => `
  WITH e AS (
    INSERT INTO public.ecritures_comptables (reference, date_ecriture, libelle, statut${extra ? ", contrepassation_de" : ""})
    VALUES ('${ref}', '${date}', '${ref}', '${statut}'${extra ? `, ${extra}` : ""}) RETURNING ecriture_id)
  INSERT INTO public.ecriture_lignes (ecriture_id, compte, debit, credit)
  SELECT e.ecriture_id, v.compte, v.d, v.c
    FROM e, (VALUES ${lignes.map(([c, d, k]) => `('${c}', ${d}::numeric, ${k}::numeric)`).join(", ")}) v(compte, d, c);`;

const EX = (libelle: string) =>
  `(SELECT exercice_id FROM public.exercices_comptables WHERE libelle = '${libelle}')`;
const tableau = async () =>
  (await db.query<{ r: Tableau }>(`SELECT public.compta_tableau_de_bord(${EX("2025")}) AS r`))
    .rows[0].r;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    SOCLE_SUPABASE +
      TABLES_COMPTA +
      `
    CREATE TABLE public.plan_comptable (
      compte_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), numero text UNIQUE NOT NULL, libelle text NOT NULL);
    INSERT INTO public.plan_comptable (numero, libelle) VALUES ('60', 'Achats et variations de stocks');
    INSERT INTO public.exercices_comptables (libelle, date_debut, date_fin, statut)
      VALUES ('2024', '2024-01-01', '2024-12-31', 'cloture');
  `,
  );
  for (const f of [
    "_resolve_exercice_id(",
    "_ecriture_sync(",
    "_ecriture_ligne_sync(",
    "compta_balance(",
  ]) {
    await db.exec(fonctionMigration(f));
  }
  await db.exec(`
    CREATE TRIGGER trg_ecriture_sync BEFORE INSERT OR UPDATE ON public.ecritures_comptables FOR EACH ROW EXECUTE FUNCTION public._ecriture_sync();
    CREATE TRIGGER trg_ecriture_ligne_sync BEFORE INSERT OR UPDATE ON public.ecriture_lignes FOR EACH ROW EXECUTE FUNCTION public._ecriture_ligne_sync();
  `);
  await db.exec(TECHNIQUE + migration("0108_compta_integrite_ecritures.sql"));
  await db.exec(TECHNIQUE + migration("0114_compta_tableau_de_bord.sql"));
  await db.exec(
    TECHNIQUE +
      ecriture("CAPITAL", "2024-02-01", [
        ["521", 1000, 0],
        ["101", 0, 1000],
      ]) +
      ecriture("VENTE", "2025-03-05", [
        ["4111", 5000, 0],
        ["7011", 0, 5000],
      ]) +
      ecriture("ENCAISSEMENT", "2025-04-10", [
        ["521", 2000, 0],
        ["4111", 0, 2000],
      ]) +
      ecriture("ACHAT", "2025-05-02", [
        ["601", 1500, 0],
        ["401", 0, 1500],
      ]) +
      ecriture("PAIE", "2025-05-31", [
        ["661", 800, 0],
        ["422", 0, 800],
      ]) +
      ecriture("HAO", "2025-06-15", [
        ["571", 100, 0],
        ["841", 0, 100],
      ]) +
      ecriture(
        "BROUILLON",
        "2025-06-20",
        [
          ["601", 50, 0],
          ["571", 0, 50],
        ],
        "",
        "brouillon",
      ) +
      ecriture("ERREUR", "2025-07-01", [
        ["658", 100, 0],
        ["571", 0, 100],
      ]) +
      ecriture(
        "CP-ERREUR",
        "2025-07-01",
        [
          ["658", 0, 100],
          ["571", 100, 0],
        ],
        `(SELECT ecriture_id FROM public.ecritures_comptables WHERE reference = 'ERREUR')`,
      ) +
      `UPDATE public.ecritures_comptables SET contrepassee_le = now() WHERE reference = 'ERREUR';` +
      UTILISATEUR,
  );
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("avant 0114 : défaut reproduit", () => {
  it("la trésorerie calculée sur les seuls mouvements de l'exercice oublie le solde d'ouverture", async () => {
    // Calcul de l'ancien tableau de bord : balance filtrée sur l'exercice, classe 5.
    const r = await db.query<{ t: string }>(
      `SELECT sum(solde) AS t FROM public.compta_balance(NULL, NULL, ${EX("2025")}) WHERE numero_compte LIKE '5%'`,
    );
    expect(Number(r.rows[0].t)).toBe(2050); // au lieu de 3 050 réellement en banque et en caisse
  });
});

describe("tableau de bord comptable (0114)", () => {
  it("résultat : chiffre d'affaires, produits, charges, hors activités ordinaires", async () => {
    expect((await tableau()).resultat).toEqual({
      chiffre_affaires: 5000,
      produits: 5000,
      charges: 2350, // 1 500 + 50 (brouillon) + 800 ; l'erreur annulée s'annule
      hao: 100,
      resultat: 2750,
    });
  });

  it("situation sur la balance cumulée, soldes d'ouverture compris", async () => {
    expect((await tableau()).situation).toEqual({
      tresorerie: 3050, // 1 000 apportés en 2024 + 2 000 encaissés + 100 - 50
      creances_clients: 3000,
      dettes_fournisseurs: 1500,
      dettes_sociales_fiscales: 800,
    });
  });

  it("écritures par statut et mouvements de l'exercice", async () => {
    const t = await tableau();
    expect(t.ecritures).toEqual({ total: 8, validees: 5, brouillons: 1, annulees: 2 });
    expect(t.mouvements).toEqual({
      debit: 9650,
      credit: 9650,
      soldes_debiteurs: 7400,
      soldes_crediteurs: 7400,
      comptes_mouvementes: 10,
    });
  });

  it("évolution mensuelle sur les 12 mois, mois vides à zéro", async () => {
    const m = (await tableau()).mensuel;
    expect(m).toHaveLength(12);
    expect(m.find((x) => x.mois === "2025-03")).toMatchObject({
      chiffre_affaires: 5000,
      resultat: 5000,
    });
    expect(m.find((x) => x.mois === "2025-05")).toMatchObject({ charges: 2300, resultat: -2300 });
    expect(m.find((x) => x.mois === "2025-06")).toMatchObject({ charges: 50, resultat: 50 });
    expect(m.find((x) => x.mois === "2025-12")).toMatchObject({ chiffre_affaires: 0, charges: 0 });
    expect(m.reduce((s, x) => s + x.resultat, 0)).toBe(2750);
  });

  it("charges par compte principal, libellé du plan", async () => {
    expect((await tableau()).charges_par_compte).toEqual([
      { compte: "60", libelle: "Achats et variations de stocks", montant: 1550 },
      { compte: "66", libelle: "Compte 66", montant: 800 },
    ]);
  });

  it("réservé au droit comptabilite.voir", async () => {
    await db.exec(`INSERT INTO public.permissions_refusees VALUES ('comptabilite.voir');`);
    await expect(tableau()).rejects.toThrow(/comptabilite\.voir/);
    await db.exec(`DELETE FROM public.permissions_refusees;`);
  });
});
