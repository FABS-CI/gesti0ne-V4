// @vitest-environment node
// Clôture d'exercice et balance à six colonnes (migration 0112), sur un vrai PostgreSQL
// (PGlite). Les verrous de 0108 sont chargés tels que définis par le projet.
// Scénario : 2024 clôturé, 2025 terminé et ouvert (à clôturer), 2026 absent puis créé.

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

async function erreur(sql: string): Promise<string | null> {
  try {
    await db.exec(sql);
    return null;
  } catch (e) {
    await db.exec("ROLLBACK").catch(() => undefined);
    return (e as Error).message;
  }
}

type Apercu = {
  exercice: { code: string; date_fin: string };
  exercice_suivant: { exercice_id: string | null; code: string; a_creer: boolean } | null;
  comptes: { nb_ecritures: number; total_debit: number; total_credit: number; resultat: number };
  blocages: { code: string; severite: "error" | "warning"; nombre: number; message: string }[];
  peut_cloturer: boolean;
};

const EX = (libelle: string) =>
  `(SELECT exercice_id FROM public.exercices_comptables WHERE libelle = '${libelle}')`;

const apercu = async (libelle = "2025") =>
  (await db.query<{ r: Apercu }>(`SELECT public.preview_cloture_exercice(${EX(libelle)}) AS r`))
    .rows[0].r;
const codes = async (libelle = "2025") =>
  (await apercu(libelle)).blocages.map((b) => `${b.severite}:${b.code}`).sort();

/** Écriture manuelle : lignes [compte, débit, crédit]. */
const ecriture = (
  ref: string,
  date: string,
  lignes: [string, number, number][],
  statut = "valide",
  piece = "NULL",
) => `
  WITH e AS (
    INSERT INTO public.ecritures_comptables (reference, date_ecriture, libelle, statut, piece_ref)
    VALUES ('${ref}', '${date}', 'Écriture ${ref}', '${statut}', ${piece}) RETURNING ecriture_id)
  INSERT INTO public.ecriture_lignes (ecriture_id, compte, compte_libelle, debit, credit)
  SELECT e.ecriture_id, v.compte, 'Ligne ' || v.compte || ' ${ref}', v.d, v.c
    FROM e, (VALUES ${lignes.map(([c, d, k]) => `('${c}', ${d}::numeric, ${k}::numeric)`).join(", ")}) v(compte, d, c);`;

/** piece_ref d'une pièce : « FACT:<id> », « ACH:<id> ». */
const PIECE = (type: string, table: string, id: string, ref: string) =>
  `(SELECT '${type}:' || ${id} FROM public.${table} WHERE reference = '${ref}')`;

const C1 = "cccccccc-0000-0000-0000-000000000001";
const F1 = "dddddddd-0000-0000-0000-000000000001";

/**
 * Base de test. apres = false : état d'avant 0112 (fonctions de clôture de juillet,
 * verrous de 0108), avec l'exercice 2026 déjà créé.
 */
async function preparer(apres: boolean): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(
    SOCLE_SUPABASE +
      TABLES_COMPTA +
      `
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
    INSERT INTO auth.users VALUES ('00000000-0000-0000-0000-000000000001', 'compta@fabs.ci');
    CREATE TABLE public.plan_comptable (
      compte_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), numero text UNIQUE NOT NULL, libelle text NOT NULL);
    INSERT INTO public.plan_comptable (numero, libelle)
      VALUES ('411', 'Clients'), ('521', 'Banques'), ('601', 'Achats de marchandises'), ('701', 'Ventes de marchandises');
    CREATE TABLE public.clients (client_id uuid PRIMARY KEY, nom text);
    INSERT INTO public.clients VALUES ('${C1}', 'Librairie Plateau');
    CREATE TABLE public.factures (
      facture_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reference text, client_id uuid,
      date_facture date, montant_total numeric, statut text DEFAULT 'emise', exercice_id uuid);
    CREATE TABLE public.paiements (
      paiement_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reference text, date_paiement date,
      montant numeric, statut text DEFAULT 'en_attente');
    CREATE TABLE public.achats (
      achat_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reference text, fournisseur_id uuid,
      date_achat date, montant numeric, statut text DEFAULT 'brouillon', exercice_id uuid);
    CREATE TABLE public.soldes_ouverture_clients (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), client_id uuid NOT NULL, exercice_id uuid NOT NULL,
      montant numeric NOT NULL, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
    CREATE TABLE public.soldes_ouverture_fournisseurs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), fournisseur_id uuid NOT NULL, exercice_id uuid NOT NULL,
      montant numeric NOT NULL, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
    CREATE TABLE public.exercice_cloture_journal (
      journal_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), exercice_source_id uuid, exercice_cible_id uuid,
      date_cloture timestamptz, cloture_par text, nb_clients_reportes int NOT NULL DEFAULT 0,
      montant_total_clients numeric NOT NULL DEFAULT 0, nb_fournisseurs_reportes int NOT NULL DEFAULT 0,
      montant_total_fournisseurs numeric NOT NULL DEFAULT 0, details jsonb,
      created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
  `,
  );
  for (const f of ["_resolve_exercice_id(", "_ecriture_sync(", "_ecriture_ligne_sync("]) {
    await db.exec(fonctionMigration(f));
  }
  await db.exec(`
    CREATE TRIGGER trg_ecriture_sync BEFORE INSERT OR UPDATE ON public.ecritures_comptables FOR EACH ROW EXECUTE FUNCTION public._ecriture_sync();
    CREATE TRIGGER trg_ecriture_ligne_sync BEFORE INSERT OR UPDATE ON public.ecriture_lignes FOR EACH ROW EXECUTE FUNCTION public._ecriture_ligne_sync();
  `);
  // paie_controle_ecarts (0110) est appelé par le contrôle global repris dans 0112.
  await db.exec(`CREATE FUNCTION public.paie_controle_ecarts()
    RETURNS TABLE(anomalie text, bulletin_id uuid, reference text, montant_bulletin numeric, montant_ecritures numeric)
    LANGUAGE sql AS $$ SELECT NULL::text, NULL::uuid, NULL::text, NULL::numeric, NULL::numeric WHERE false $$;
    CREATE TABLE public.transactions (transaction_id uuid, reference text, montant numeric, statut text, categorie text);`);
  await db.exec(TECHNIQUE + migration("0108_compta_integrite_ecritures.sql"));
  if (apres) {
    await db.exec(TECHNIQUE + migration("0112_compta_cloture_exercice.sql"));
  } else {
    // Colonnes lues par les fonctions de juillet.
    await db.exec(`CREATE TABLE public.commandes (exercice_id uuid, montant_total numeric);
      ALTER TABLE public.factures ADD COLUMN montant_paye numeric DEFAULT 0;`);
    for (const f of ["preview_cloture_exercice(", "executer_cloture_exercice("]) {
      await db.exec(fonctionMigration(f, "0112_"));
    }
  }
  // Historique : 2024 clôturé avec une vente à crédit ; 2025 terminé, encore ouvert ;
  // pas encore de 2026 (il sera créé par la clôture).
  await db.exec(
    TECHNIQUE +
      `
    ${apres ? "DELETE FROM public.exercices_comptables WHERE libelle = '2026';" : ""}
    UPDATE public.exercices_comptables SET statut = 'actif', is_actif = true WHERE libelle = '2025';
    INSERT INTO public.exercices_comptables (libelle, code, date_debut, date_fin, statut)
      VALUES ('2024', '2024', '2024-01-01', '2024-12-31', 'cloture');
    INSERT INTO public.factures (reference, client_id, date_facture, montant_total)
      VALUES ('FAC-2024', '${C1}', '2024-06-10', 1000);
    ${ecriture(
      "VTE-FAC-2024",
      "2024-06-10",
      [
        ["411", 1000, 0],
        ["701", 0, 1000],
      ],
      "valide",
      PIECE("FACT", "factures", "facture_id", "FAC-2024"),
    )}
    INSERT INTO public.achats (reference, fournisseur_id, date_achat, montant, statut) VALUES
      ('ACH-2024', '${F1}', '2024-11-02', 300, 'confirme');
    ${ecriture(
      "E-ACH-2024",
      "2024-11-02",
      [
        ["601", 300, 0],
        ["401", 0, 300],
      ],
      "valide",
      PIECE("ACH", "achats", "achat_id", "ACH-2024"),
    )}
    ` +
      UTILISATEUR +
      `
    ${ecriture("VTE-2025", "2025-03-01", [
      ["411", 5000, 0],
      ["701", 0, 5000],
    ])}
    ${ecriture("BQ-2025", "2025-04-01", [
      ["521", 2000, 0],
      ["411", 0, 2000],
    ])}
    INSERT INTO public.achats (reference, fournisseur_id, date_achat, montant, statut) VALUES
      ('ACH-F2', '${F1}', '2025-05-01', 1500, 'confirme'),
      ('ACH-BROUILLON', '${F1}', '2025-06-01', 99, 'brouillon'),
      ('ACH-PAYE', '${F1}', '2025-02-01', 50, 'paye');
    ${ecriture(
      "E-ACH-F2",
      "2025-05-01",
      [
        ["601", 1500, 0],
        ["401", 0, 1500],
      ],
      "valide",
      PIECE("ACH", "achats", "achat_id", "ACH-F2"),
    )}
    ${ecriture(
      "E-ACH-PAYE",
      "2025-02-01",
      [
        ["601", 50, 0],
        ["401", 0, 50],
      ],
      "valide",
      PIECE("ACH", "achats", "achat_id", "ACH-PAYE"),
    )}
  `,
  );
  // Pièces rattachées à leur exercice, comme dans l'application.
  await db.exec(`UPDATE public.achats SET exercice_id = public._resolve_exercice_id(date_achat);
    UPDATE public.factures SET exercice_id = public._resolve_exercice_id(date_facture);`);
  return db;
}

beforeAll(async () => {
  db = await preparer(true);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("avant 0112 : défauts reproduits", () => {
  let avant: PGlite;
  beforeAll(async () => {
    avant = await preparer(false);
  }, 60_000);
  afterAll(async () => {
    await avant?.close();
  });

  it("l'aperçu n'a pas le format de l'écran, et ne signale rien", async () => {
    const r = (
      await avant.query<{ r: Record<string, unknown> }>(
        `SELECT public.preview_cloture_exercice(${EX("2025")}) AS r`,
      )
    ).rows[0].r;
    expect(r.exercice).toBeUndefined();
    expect(r.peut_cloturer).toBeUndefined();
    expect(r.anomalies).toEqual([]);
  });

  it("clôture malgré une écriture déséquilibrée, et reporte les impayés clients déjà repris par l'état de compte", async () => {
    await avant.exec(
      UTILISATEUR +
        ecriture("OD-BANCALE", "2025-08-01", [["601", 100, 0]], "brouillon") +
        `INSERT INTO public.factures (reference, client_id, date_facture, montant_total, exercice_id)
           VALUES ('FAC-2025', '${C1}', '2025-09-01', 800, ${EX("2025")});`,
    );
    await avant.exec(`SELECT public.executer_cloture_exercice(${EX("2025")}, true)`);
    const statut = await avant.query<{ statut: string }>(
      `SELECT statut FROM public.exercices_comptables WHERE libelle = '2025'`,
    );
    expect(statut.rows[0].statut).toBe("cloture");
    // FAC-2025 (800) devient un solde d'ouverture 2026, alors que l'état de compte 2026
    // la compte déjà dans le report antérieur (toutes les factures avant le 01/01/2026).
    const ouv = await avant.query<{ montant: string }>(
      `SELECT montant FROM public.soldes_ouverture_clients WHERE exercice_id = ${EX("2026")}`,
    );
    expect(ouv.rows.map((x) => Number(x.montant))).toEqual([800]);
    // Fournisseurs : l'achat de 2024 encore dû est oublié, le brouillon est reporté.
    const four = await avant.query<{ montant: string }>(
      `SELECT montant FROM public.soldes_ouverture_fournisseurs WHERE exercice_id = ${EX("2026")}`,
    );
    expect(four.rows.map((x) => Number(x.montant))).toEqual([1599]);
  });
});

describe("balance (0112)", () => {
  it("un compte absent du plan comptable sort sur une seule ligne", async () => {
    await db.exec(
      ecriture("OD-A", "2025-07-01", [
        ["4711", 10, 0],
        ["521", 0, 10],
      ]) +
        ecriture("OD-B", "2025-07-02", [
          ["4711", 20, 0],
          ["521", 0, 20],
        ]),
    );
    const r = await db.query<{ numero_compte: string; debit: string }>(
      `SELECT numero_compte, debit FROM public.compta_balance() WHERE numero_compte = '4711'`,
    );
    expect(r.rows).toHaveLength(1);
    expect(Number(r.rows[0].debit)).toBe(30);
  });

  it("balance d'exercice : à-nouveaux des classes 1 à 5, résultat antérieur au report à nouveau", async () => {
    const r = await db.query<{
      numero_compte: string;
      calcule: boolean;
      ouverture_debit: string;
      ouverture_credit: string;
      mouvement_debit: string;
      mouvement_credit: string;
      solde_debit: string;
    }>(`SELECT * FROM public.compta_balance_exercice(${EX("2025")})`);
    const ligne = (n: string) => r.rows.find((x) => x.numero_compte === n)!;
    // 411 : 1 000 ouvert en 2024, + 5 000 - 2 000 en 2025.
    expect(Number(ligne("411").ouverture_debit)).toBe(1000);
    expect(Number(ligne("411").solde_debit)).toBe(4000);
    // La vente 2024 (classe 7) ne se rouvre pas : elle passe au report à nouveau calculé.
    expect(ligne("701").ouverture_credit).toBe("0");
    expect(Number(ligne("701").mouvement_credit)).toBe(5000);
    expect(ligne("12").calcule).toBe(true);
    // Résultat 2024 (vente 1 000 - achat 300) au report à nouveau.
    expect(Number(ligne("12").ouverture_credit)).toBe(700);
    expect(Number(ligne("401").ouverture_credit)).toBe(300);
    // Équilibre de chaque colonne.
    const somme = (k: keyof (typeof r.rows)[number]) =>
      r.rows.reduce((s, x) => s + Number(x[k]), 0);
    expect(somme("ouverture_debit")).toBe(somme("ouverture_credit"));
    expect(somme("mouvement_debit")).toBe(somme("mouvement_credit"));
  });
});

describe("aperçu de clôture (0112)", () => {
  it("renvoie le format attendu par l'écran, avec le résultat de l'exercice", async () => {
    const a = await apercu();
    expect(a.exercice.code).toBe("2025");
    expect(a.exercice_suivant).toMatchObject({ exercice_id: null, code: "2026", a_creer: true });
    // Produits 5 000 - charges 1 550.
    expect(a.comptes.resultat).toBe(3450);
    expect(a.comptes.total_debit).toBe(a.comptes.total_credit);
    expect(a.peut_cloturer).toBe(true);
    expect(await codes()).toEqual(["warning:exercice_suivant_cree"]);
  });

  it("refuse un exercice non terminé et un exercice précédent ouvert", async () => {
    await db.exec(
      TECHNIQUE +
        `INSERT INTO public.exercices_comptables (libelle, code, date_debut, date_fin, statut)
           VALUES ('2023', '2023', '2023-01-01', '2023-12-31', 'actif'),
                  ('futur', 'futur', current_date - 10, current_date + 300, 'preparation');` +
        UTILISATEUR,
    );
    expect(await codes()).toContain("error:precedent_ouvert");
    expect(await codes("futur")).toContain("error:exercice_non_termine");
    await db.exec(
      TECHNIQUE +
        `UPDATE public.exercices_comptables SET statut = 'cloture' WHERE libelle = '2023';
         DELETE FROM public.exercices_comptables WHERE libelle = 'futur';` +
        UTILISATEUR,
    );
    expect(await codes()).toEqual(["warning:exercice_suivant_cree"]);
  });

  it("refuse un trou entre l'exercice et le suivant", async () => {
    await db.exec(
      TECHNIQUE +
        `INSERT INTO public.exercices_comptables (libelle, date_debut, date_fin)
           VALUES ('2027', '2027-01-01', '2027-12-31');` +
        UTILISATEUR,
    );
    expect(await codes()).toEqual(["error:exercice_suivant_non_contigu"]);
    await db.exec(
      TECHNIQUE + `DELETE FROM public.exercices_comptables WHERE libelle = '2027';` + UTILISATEUR,
    );
  });

  it("bloque sur une écriture déséquilibrée, levée par neutralisation tracée", async () => {
    await db.exec(ecriture("OD-BANCALE", "2025-08-01", [["601", 100, 0]], "brouillon"));
    expect(await codes()).toContain("error:ecritures_desequilibrees");
    expect(await erreur(`SELECT public.executer_cloture_exercice(${EX("2025")}, true)`)).toMatch(
      /Clôture refusée : .*déséquilibrée/,
    );

    expect(
      await erreur(
        `SELECT public.compta_neutraliser_ecriture(
           (SELECT ecriture_id FROM public.ecritures_comptables WHERE reference = 'OD-BANCALE'), 'non')`,
      ),
    ).toMatch(/Motif obligatoire/);
    await db.exec(
      `SELECT public.compta_neutraliser_ecriture(
         (SELECT ecriture_id FROM public.ecritures_comptables WHERE reference = 'OD-BANCALE'),
         'Saisie incomplète de 2025');`,
    );
    expect(await codes()).toEqual(["warning:exercice_suivant_cree"]);
    // La paire reste visible et s'annule dans la balance.
    const cp = await db.query<{ date_ecriture: string; statut: string }>(
      `SELECT date_ecriture::text, statut FROM public.ecritures_comptables WHERE reference = 'CP-OD-BANCALE'`,
    );
    expect(cp.rows).toEqual([{ date_ecriture: "2025-08-01", statut: "brouillon" }]);
    expect((await db.query(`SELECT * FROM public.compta_ecritures_desequilibrees()`)).rows).toEqual(
      [],
    );
    const s601 = await db.query<{ debit: string; solde: string }>(
      `SELECT debit, solde FROM public.compta_balance('2025-01-01', '2025-12-31') WHERE numero_compte = '601'`,
    );
    expect(Number(s601.rows[0].debit)).toBe(1650); // achats 1 550 + 100 de la paire neutralisée
    expect(Number(s601.rows[0].solde)).toBe(1550);
    expect(
      (
        await db.query(
          `SELECT * FROM public.controle_integrite_global() WHERE domaine = 'Comptabilité'`,
        )
      ).rows,
    ).toEqual([]);
  });

  it("une écriture générée par une pièce ne se neutralise pas", async () => {
    expect(
      await erreur(
        `SELECT public.compta_neutraliser_ecriture(
           (SELECT ecriture_id FROM public.ecritures_comptables WHERE reference = 'E-ACH-F2'), 'Essai de neutralisation')`,
      ),
    ).toMatch(/annulez la pièce/);
  });

  it("bloque sur une pièce validée sans écriture, et sur une écriture rattachée au mauvais exercice", async () => {
    await db.exec(
      `INSERT INTO public.factures (reference, client_id, date_facture, montant_total)
         VALUES ('FAC-2025', '${C1}', '2025-09-01', 800);` +
        ecriture("OD-DECALEE", "2025-09-02", [
          ["521", 5, 0],
          ["701", 0, 5],
        ]),
    );
    await db.exec(
      TECHNIQUE +
        `UPDATE public.ecritures_comptables SET exercice_id = ${EX("2024")} WHERE reference = 'OD-DECALEE';` +
        UTILISATEUR,
    );
    expect(await codes()).toEqual([
      "error:ecritures_hors_exercice",
      "error:pieces_non_comptabilisees",
      "warning:exercice_suivant_cree",
    ]);
    await db.exec(
      TECHNIQUE +
        `UPDATE public.ecritures_comptables SET exercice_id = ${EX("2025")} WHERE reference = 'OD-DECALEE';` +
        UTILISATEUR +
        ecriture("VTE-FAC-2025", "2025-09-01", [
          ["411", 800, 0],
          ["701", 0, 800],
        ]) +
        `UPDATE public.ecritures_comptables SET piece_ref = 'FACT:' || (SELECT facture_id FROM public.factures WHERE reference = 'FAC-2025')
          WHERE reference = 'VTE-FAC-2025';`,
    );
    expect(await codes()).toEqual(["warning:exercice_suivant_cree"]);
  });

  it("signale les brouillons équilibrés et les soldes d'ouverture clients en double, sans bloquer", async () => {
    await db.exec(
      ecriture(
        "OD-BROUILLON",
        "2025-10-01",
        [
          ["601", 7, 0],
          ["521", 0, 7],
        ],
        "brouillon",
      ) +
        `INSERT INTO public.soldes_ouverture_clients (client_id, exercice_id, montant)
           VALUES ('${C1}', ${EX("2025")}, 1000);`,
    );
    expect(await codes()).toEqual([
      "warning:ecritures_brouillon",
      "warning:exercice_suivant_cree",
      "warning:soldes_ouverture_doublons",
    ]);
    expect((await apercu()).peut_cloturer).toBe(true);
    const d = await db.query<{ client_nom: string; factures_anterieures: number }>(
      `SELECT client_nom, factures_anterieures FROM public.compta_soldes_ouverture_doublons()`,
    );
    expect(d.rows).toEqual([{ client_nom: "Librairie Plateau", factures_anterieures: 1 }]);
  });

  it("réservé au droit exercices.cloturer", async () => {
    await db.exec(`INSERT INTO public.permissions_refusees VALUES ('exercices.cloturer');`);
    expect(await erreur(`SELECT public.preview_cloture_exercice(${EX("2025")})`)).toMatch(
      /exercices\.cloturer/,
    );
    expect(await erreur(`SELECT public.executer_cloture_exercice(${EX("2025")}, true)`)).toMatch(
      /exercices\.cloturer/,
    );
    await db.exec(`DELETE FROM public.permissions_refusees;`);
  });
});

describe("exécution de la clôture (0112)", () => {
  it("clôture, crée et active l'exercice suivant, trace la clôture", async () => {
    const nbSoldesClients = (await db.query(`SELECT 1 FROM public.soldes_ouverture_clients`)).rows
      .length;
    const r = await db.query<{ r: Record<string, unknown> }>(
      `SELECT public.executer_cloture_exercice(${EX("2025")}, true) AS r`,
    );
    expect(r.rows[0].r).toMatchObject({ exercice_suivant_cree: true, nb_clients_reportes: 0 });

    const ex = await db.query<{
      libelle: string;
      statut: string;
      is_actif: boolean;
      date_debut: string;
      date_fin: string;
    }>(
      `SELECT libelle, statut, is_actif, date_debut::text, date_fin::text FROM public.exercices_comptables
        WHERE libelle IN ('2025', '2026') ORDER BY libelle`,
    );
    expect(ex.rows).toEqual([
      {
        libelle: "2025",
        statut: "cloture",
        is_actif: false,
        date_debut: "2025-01-01",
        date_fin: "2025-12-31",
      },
      {
        libelle: "2026",
        statut: "actif",
        is_actif: true,
        date_debut: "2026-01-01",
        date_fin: "2026-12-31",
      },
    ]);
    // Clients : aucun solde d'ouverture créé (l'état de compte reprend les factures antérieures).
    expect((await db.query(`SELECT 1 FROM public.soldes_ouverture_clients`)).rows.length).toBe(
      nbSoldesClients,
    );

    const j = await db.query<{ cloture_par: string; details: { comptes: { resultat: number } } }>(
      `SELECT cloture_par, details FROM public.exercice_cloture_journal`,
    );
    expect(j.rows).toHaveLength(1);
    expect(j.rows[0].cloture_par).toBe("compta@fabs.ci");
    expect(typeof j.rows[0].details.comptes.resultat).toBe("number");
  });

  it("reporte les achats fournisseurs confirmés non payés, anciens compris, hors brouillons", async () => {
    const s = await db.query<{ montant: string }>(
      `SELECT montant FROM public.soldes_ouverture_fournisseurs
        WHERE fournisseur_id = '${F1}' AND exercice_id = ${EX("2026")}`,
    );
    // 300 (2024, toujours dû) + 1 500 (2025) ; ni le brouillon ni l'achat payé.
    expect(s.rows.map((x) => Number(x.montant))).toEqual([1800]);
  });

  it("l'exercice clôturé est verrouillé, et ne se clôture pas deux fois", async () => {
    expect(
      await erreur(
        ecriture("OD-TARDIVE", "2025-12-30", [
          ["601", 1, 0],
          ["521", 0, 1],
        ]),
      ),
    ).toMatch(/clôturé/);
    expect(await erreur(`SELECT public.executer_cloture_exercice(${EX("2025")}, true)`)).toMatch(
      /déjà clôturé/,
    );
  });

  it("se rejoue sans erreur (idempotente)", async () => {
    expect(await erreur(TECHNIQUE + migration("0112_compta_cloture_exercice.sql"))).toBeNull();
  });
});
