// @vitest-environment node
// Intégrité des écritures comptables (migration 0108), sur un vrai PostgreSQL (PGlite).
// Les fonctions du projet (synchronisations, générateur et déclencheur des factures)
// sont reprises telles que définies par les migrations ; la migration 0108 est
// appliquée telle quelle, puis rejouée pour vérifier qu'elle est idempotente.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const MIGRATION = "drizzle/migrations/0108_compta_integrite_ecritures.sql";
const FICHIERS = [
  ...readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => join("supabase/migrations", f)),
  ...readdirSync("drizzle/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => join("drizzle/migrations", f)),
];

/** Dernière définition d'une fonction dans les migrations (texte jusqu'au « $$; »). */
function fonction(nom: string): string {
  let dernier: string | null = null;
  const motif = `CREATE OR REPLACE FUNCTION public.${nom}(`;
  for (const f of FICHIERS) {
    const s = readFileSync(f, "utf8");
    for (let i = s.indexOf(motif); i >= 0; i = s.indexOf(motif, i + 1)) {
      const fin = s.indexOf("$$", s.indexOf("$$", i) + 2);
      dernier = s.slice(i, s.indexOf(";", fin) + 1);
    }
  }
  if (!dernier) throw new Error(`fonction introuvable : ${nom}`);
  return dernier;
}

const UTILISATEUR = `SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000001"}', false);`;
const TECHNIQUE = `SELECT set_config('request.jwt.claims', '', false);`;
const ID_EQ = "11111111-1111-1111-1111-111111111111";

let db: PGlite;

/** Message d'erreur de l'instruction, ou null si elle passe. */
async function erreur(sql: string): Promise<string | null> {
  try {
    await db.exec(sql);
    return null;
  } catch (e) {
    await db.exec("ROLLBACK").catch(() => undefined);
    return (e as Error).message;
  }
}
const nombre = async (sql: string, params: unknown[] = []) =>
  Number((await db.query<{ n: string }>(sql, params)).rows[0].n);
const solde = (compte: string) =>
  nombre(
    `SELECT coalesce(sum(debit - credit), 0) AS n FROM public.ecriture_lignes WHERE compte = $1`,
    [compte],
  );
const saisir = (lignes: object[], libelle: string | null = "Loyer mars", date = "2026-03-05") =>
  erreur(
    `SELECT public.compta_saisir_ecriture('${date}', 'OD', NULL, ${libelle === null ? "NULL" : `'${libelle}'`}, '${JSON.stringify(lignes)}'::jsonb);`,
  );

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid $$;
    CREATE TABLE public.permissions_refusees (code text);
    CREATE FUNCTION public.has_permission(_u uuid, _c text) RETURNS boolean LANGUAGE sql STABLE AS $$
      SELECT _u IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.permissions_refusees WHERE code = _c) $$;
    CREATE TABLE public.exercices_comptables (
      exercice_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), libelle text, code text,
      date_debut date NOT NULL, date_fin date NOT NULL, statut text NOT NULL DEFAULT 'ouvert',
      is_actif boolean NOT NULL DEFAULT false, cloture_le timestamptz,
      created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
    CREATE TABLE public.journaux_comptables (journal_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text);
    INSERT INTO public.journaux_comptables (code) VALUES ('VTE'), ('OD');
    -- Colonnes réelles (types générés depuis la base).
    CREATE TABLE public.ecritures_comptables (
      ecriture_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reference text, exercice_id uuid,
      journal_id uuid, journal text, date_ecriture date DEFAULT current_date, libelle text,
      montant numeric DEFAULT 0, montant_total numeric DEFAULT 0, statut text DEFAULT 'brouillon',
      piece_ref text, lettrage text, source_type text, source_id uuid,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE public.ecriture_lignes (
      ligne_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      ecriture_id uuid NOT NULL REFERENCES public.ecritures_comptables(ecriture_id) ON DELETE CASCADE,
      compte_id uuid, numero_compte text, compte text, compte_libelle text, libelle text,
      debit numeric DEFAULT 0, credit numeric DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE public.factures (
      facture_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reference text, client_nom text,
      date_facture date DEFAULT current_date, montant_total numeric, statut text DEFAULT 'emise', exercice_id uuid);
    CREATE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
  `);
  for (const f of [
    "_resolve_exercice_id",
    "_journal_id",
    "_ecriture_sync",
    "_ecriture_ligne_sync",
    "generate_ecriture_facture",
    "_trg_facture_ecriture",
  ]) {
    await db.exec(fonction(f));
  }
  await db.exec(`
    CREATE TRIGGER trg_ecriture_sync BEFORE INSERT OR UPDATE ON public.ecritures_comptables FOR EACH ROW EXECUTE FUNCTION public._ecriture_sync();
    CREATE TRIGGER trg_ecritures_updated_at BEFORE UPDATE ON public.ecritures_comptables FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    CREATE TRIGGER trg_ecriture_ligne_sync BEFORE INSERT OR UPDATE ON public.ecriture_lignes FOR EACH ROW EXECUTE FUNCTION public._ecriture_ligne_sync();
    CREATE TRIGGER trg_facture_ecriture AFTER INSERT OR UPDATE OR DELETE ON public.factures FOR EACH ROW EXECUTE FUNCTION public._trg_facture_ecriture();
    INSERT INTO public.exercices_comptables (libelle, date_debut, date_fin, statut, is_actif)
      VALUES ('2025', '2025-01-01', '2025-12-31', 'cloture', false),
             ('2026', '2026-01-01', '2026-12-31', 'actif', true);
    -- Écriture déséquilibrée enregistrée avant la correction.
    WITH e AS (INSERT INTO public.ecritures_comptables (reference, date_ecriture, statut)
               VALUES ('ANCIENNE-DESEQ', '2026-02-01', 'valide') RETURNING ecriture_id)
    INSERT INTO public.ecriture_lignes (ecriture_id, compte, debit, credit) SELECT ecriture_id, '601', 500, 0 FROM e;
  `);
  await db.exec(readFileSync(MIGRATION, "utf8"));
  await db.exec(UTILISATEUR);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("migration 0108", () => {
  it("se rejoue sans erreur (idempotente)", async () => {
    expect(await erreur(TECHNIQUE + readFileSync(MIGRATION, "utf8") + UTILISATEUR)).toBeNull();
  });
});

describe("équilibre débit = crédit", () => {
  it("refuse une écriture validée déséquilibrée, sans rien enregistrer", async () => {
    const e = await erreur(`
      WITH e AS (INSERT INTO public.ecritures_comptables (reference, date_ecriture, statut)
                 VALUES ('DESEQ', '2026-03-01', 'valide') RETURNING ecriture_id)
      INSERT INTO public.ecriture_lignes (ecriture_id, compte, debit, credit) SELECT ecriture_id, '601', 1000, 0 FROM e;`);
    expect(e).toMatch(/déséquilibrée/);
    expect(
      await nombre(
        `SELECT count(*) AS n FROM public.ecritures_comptables WHERE reference = 'DESEQ'`,
      ),
    ).toBe(0);
  });

  it("accepte une écriture équilibrée construite ligne par ligne dans une transaction", async () => {
    expect(
      await erreur(`BEGIN;
        INSERT INTO public.ecritures_comptables (ecriture_id, reference, date_ecriture, statut) VALUES ('${ID_EQ}', 'EQ', '2026-03-01', 'valide');
        INSERT INTO public.ecriture_lignes (ecriture_id, compte, debit, credit) VALUES ('${ID_EQ}', '601', 1000, 0);
        INSERT INTO public.ecriture_lignes (ecriture_id, compte, debit, credit) VALUES ('${ID_EQ}', '521', 0, 1000);
        COMMIT;`),
    ).toBeNull();
  });

  it("refuse de valider un brouillon déséquilibré", async () => {
    const e = await erreur(`BEGIN;
      INSERT INTO public.ecritures_comptables (ecriture_id, reference, date_ecriture, statut)
        VALUES ('22222222-2222-2222-2222-222222222222', 'BROU', '2026-03-01', 'brouillon');
      INSERT INTO public.ecriture_lignes (ecriture_id, compte, debit, credit) VALUES ('22222222-2222-2222-2222-222222222222', '601', 700, 0);
      COMMIT;
      UPDATE public.ecritures_comptables SET statut = 'valide' WHERE reference = 'BROU';`);
    expect(e).toMatch(/Validation impossible/);
  });
});

describe("exercice clôturé", () => {
  it("refuse une nouvelle écriture datée dans un exercice clôturé", async () => {
    expect(
      await erreur(
        `INSERT INTO public.ecritures_comptables (reference, date_ecriture, statut) VALUES ('CLOS', '2025-06-01', 'valide');`,
      ),
    ).toMatch(/clôturé/);
  });
});

describe("annulation d'une pièce : contre-passation", () => {
  it("annule une facture par une écriture inverse, sans suppression", async () => {
    await db.exec(
      `INSERT INTO public.factures (reference, client_nom, date_facture, montant_total) VALUES ('FAC-1', 'Client', '2026-03-02', 5000);`,
    );
    expect(await solde("411")).toBe(5000);
    expect(await solde("701")).toBe(-5000);

    expect(
      await erreur(`UPDATE public.factures SET statut = 'annulee' WHERE reference = 'FAC-1';`),
    ).toBeNull();
    expect(await solde("411")).toBe(0);
    expect(await solde("701")).toBe(0);
    expect(
      await nombre(
        `SELECT count(*) AS n FROM public.ecritures_comptables WHERE piece_ref LIKE '%FACT:%'`,
      ),
    ).toBe(2);
    const lien = await db.query<{ ok: boolean }>(`
      SELECT o.contrepassee_par = c.ecriture_id AND c.contrepassation_de = o.ecriture_id AS ok
        FROM public.ecritures_comptables o JOIN public.ecritures_comptables c ON c.contrepassation_de = o.ecriture_id`);
    expect(lien.rows[0]?.ok).toBe(true);
  });

  it("réactivation et changement de montant : historique complet, une seule écriture active", async () => {
    await db.exec(`UPDATE public.factures SET statut = 'emise' WHERE reference = 'FAC-1';`);
    expect(await solde("411")).toBe(5000);
    await db.exec(`UPDATE public.factures SET montant_total = 8000 WHERE reference = 'FAC-1';`);
    expect(await solde("411")).toBe(8000);
    expect(
      await nombre(
        `SELECT count(*) AS n FROM public.ecritures_comptables WHERE piece_ref LIKE '%FACT:%'`,
      ),
    ).toBe(5);
    expect(
      await nombre(
        `SELECT count(*) AS n FROM public.ecritures_comptables WHERE piece_ref LIKE 'FACT:%'`,
      ),
    ).toBe(1);
  });
});

describe("écriture de plus de 24 h", () => {
  beforeAll(async () => {
    await db.exec(
      TECHNIQUE +
        `UPDATE public.ecritures_comptables SET created_at = now() - interval '3 days' WHERE reference = 'EQ';` +
        UTILISATEUR,
    );
  });

  it("verrouille ses lignes (modification, suppression, ajout)", async () => {
    expect(
      await erreur(
        `UPDATE public.ecriture_lignes SET debit = 999999 WHERE ecriture_id = '${ID_EQ}' AND compte = '601';`,
      ),
    ).toMatch(/verrouillées/);
    expect(
      await erreur(`DELETE FROM public.ecriture_lignes WHERE ecriture_id = '${ID_EQ}';`),
    ).toMatch(/verrouillées/);
    expect(
      await erreur(
        `INSERT INTO public.ecriture_lignes (ecriture_id, compte, debit, credit) VALUES ('${ID_EQ}', '601', 1, 0);`,
      ),
    ).toMatch(/verrouillées/);
  });

  it("verrouille son en-tête et en interdit la suppression", async () => {
    expect(
      await erreur(
        `UPDATE public.ecritures_comptables SET libelle = 'modifié' WHERE reference = 'EQ';`,
      ),
    ).toMatch(/plus de 24 h/);
    expect(await erreur(`DELETE FROM public.ecritures_comptables WHERE reference = 'EQ';`)).toMatch(
      /Suppression interdite/,
    );
  });

  it("reste modifiable en contexte technique (rôle service, maintenance)", async () => {
    expect(
      await erreur(
        TECHNIQUE +
          `UPDATE public.ecritures_comptables SET libelle = 'maintenance' WHERE reference = 'EQ';` +
          UTILISATEUR,
      ),
    ).toBeNull();
  });
});

describe("saisie manuelle (compta_saisir_ecriture)", () => {
  it("enregistre une écriture équilibrée : en-tête et lignes ensemble", async () => {
    expect(
      await saisir([
        { compte: "6222", compte_libelle: "Loyers", debit: 150000 },
        { compte: "5211", compte_libelle: "Banque", credit: 150000 },
      ]),
    ).toBeNull();
    const r = await db.query<{
      statut: string;
      source_type: string;
      montant_total: string;
      n: string;
    }>(`
      SELECT e.statut, e.source_type, e.montant_total, count(l.*) AS n
        FROM public.ecritures_comptables e JOIN public.ecriture_lignes l USING (ecriture_id)
       WHERE e.libelle = 'Loyer mars' GROUP BY e.ecriture_id`);
    expect(r.rows[0]).toMatchObject({ statut: "valide", source_type: "manuel" });
    expect(Number(r.rows[0].montant_total)).toBe(150000);
    expect(Number(r.rows[0].n)).toBe(2);
  });

  it("refuse les saisies invalides sans laisser d'en-tête orphelin", async () => {
    const avant = await nombre(`SELECT count(*) AS n FROM public.ecritures_comptables`);
    expect(
      await saisir(
        [
          { compte: "6222", debit: 150000 },
          { compte: "5211", credit: 100000 },
        ],
        "Deseq",
      ),
    ).toMatch(/déséquilibrée/);
    expect(await saisir([{ compte: "6222", debit: 150000 }], "Une ligne")).toMatch(/2 lignes/);
    expect(
      await saisir([{ compte: "6222", debit: 100, credit: 100 }, { compte: "5211" }], "Double"),
    ).toMatch(/Ligne invalide/);
    expect(
      await saisir(
        [
          { compte: "ABC", debit: 100 },
          { compte: "5211", credit: 100 },
        ],
        "Compte",
      ),
    ).toMatch(/Ligne invalide/);
    expect(
      await saisir(
        [
          { compte: "6222", debit: 100 },
          { compte: "5211", credit: 100 },
        ],
        null,
      ),
    ).toMatch(/Libellé/);
    expect(
      await saisir(
        [
          { compte: "6222", debit: 100 },
          { compte: "5211", credit: 100 },
        ],
        "Clos",
        "2025-06-05",
      ),
    ).toMatch(/clôturé/);
    expect(await nombre(`SELECT count(*) AS n FROM public.ecritures_comptables`)).toBe(avant);
  });

  it("exige le droit comptabilite.creer", async () => {
    await db.exec(`INSERT INTO public.permissions_refusees VALUES ('comptabilite.creer');`);
    expect(
      await saisir(
        [
          { compte: "6222", debit: 100 },
          { compte: "5211", credit: 100 },
        ],
        "Sans droit",
      ),
    ).toMatch(/Permission refusée/);
    await db.exec(`DELETE FROM public.permissions_refusees;`);
  });
});

describe("contrôle des écritures déséquilibrées existantes", () => {
  it("signale tout ce que la balance compte, brouillons compris, avec leur statut", async () => {
    const r = await db.query<{ reference: string; statut: string }>(
      `SELECT reference, statut FROM public.compta_ecritures_desequilibrees() ORDER BY reference`,
    );
    expect(r.rows).toEqual([
      { reference: "ANCIENNE-DESEQ", statut: "valide" },
      { reference: "BROU", statut: "brouillon" },
    ]);
  });
});

describe("exercice clôturé : réouverture tracée uniquement", () => {
  const ex2025 = `(SELECT exercice_id FROM public.exercices_comptables WHERE libelle = '2025')`;

  it("refuse de changer le statut ou les dates d'un exercice clôturé hors réouverture", async () => {
    expect(
      await erreur(
        `UPDATE public.exercices_comptables SET statut = 'actif' WHERE libelle = '2025';`,
      ),
    ).toMatch(/réouverture motivée/);
    expect(
      await erreur(
        `UPDATE public.exercices_comptables SET date_fin = '2025-11-30' WHERE libelle = '2025';`,
      ),
    ).toMatch(/réouverture motivée/);
  });

  it("exige le droit exercices.cloturer et un motif", async () => {
    await db.exec(`INSERT INTO public.permissions_refusees VALUES ('exercices.cloturer');`);
    expect(
      await erreur(
        `SELECT public.compta_rouvrir_exercice(${ex2025}, 'Correction de l''inventaire');`,
      ),
    ).toMatch(/Permission refusée/);
    await db.exec(`DELETE FROM public.permissions_refusees;`);
    expect(await erreur(`SELECT public.compta_rouvrir_exercice(${ex2025}, '');`)).toMatch(/Motif/);
  });

  it("rouvre l'exercice, trace la réouverture, et l'écriture redevient possible", async () => {
    expect(
      await erreur(
        `SELECT public.compta_rouvrir_exercice(${ex2025}, 'Correction de l''inventaire');`,
      ),
    ).toBeNull();
    const ex = await db.query<{ statut: string; cloture_le: string | null }>(
      `SELECT statut, cloture_le FROM public.exercices_comptables WHERE libelle = '2025'`,
    );
    expect(ex.rows[0]).toEqual({ statut: "actif", cloture_le: null });
    const trace = await db.query<{ ancien_statut: string; motif: string }>(
      `SELECT ancien_statut, motif FROM public.exercices_reouvertures`,
    );
    expect(trace.rows).toEqual([{ ancien_statut: "cloture", motif: "Correction de l'inventaire" }]);
    expect(
      await saisir(
        [
          { compte: "6222", debit: 100 },
          { compte: "5211", credit: 100 },
        ],
        "Correction 2025",
        "2025-06-05",
      ),
    ).toBeNull();
    expect(
      await erreur(`SELECT public.compta_rouvrir_exercice(${ex2025}, 'Deuxième fois');`),
    ).toMatch(/pas clôturé/);
  });
});
