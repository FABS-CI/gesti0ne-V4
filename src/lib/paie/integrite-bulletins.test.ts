// @vitest-environment node
// Intégrité des bulletins de paie (migration 0110), sur un vrai PostgreSQL (PGlite) :
// verrou après validation, annulation par contre-passation, une seule paie par période,
// contrôle des écarts paie ↔ comptabilité. Les fonctions de comptabilisation du bulletin
// (0107) et de validation sont reprises des migrations ; l'état d'avant 0110 est
// reproduit avant la correction.

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

const EMP = "eeeeeeee-0000-0000-0000-000000000001";
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
const nombre = async (sql: string) => Number((await db.query<{ n: string }>(sql)).rows[0].n);
const ecrituresActives = (id: string) =>
  nombre(`SELECT count(*) AS n FROM public.ecritures_comptables
           WHERE piece_ref = 'BUL:${id}' AND contrepassee_le IS NULL AND contrepassation_de IS NULL`);
const solde = (compte: string) =>
  nombre(
    `SELECT coalesce(sum(debit - credit), 0) AS n FROM public.ecriture_lignes WHERE compte = '${compte}'`,
  );

/** Bulletin calculé (montants du bulletin modèle 2024) et ses lignes, en brouillon. */
const bulletin = (id: string, ref: string, debut: string, fin: string) =>
  TECHNIQUE +
  `
  INSERT INTO public.bulletins_paie (bulletin_id, reference, employe_id, employe_nom, periode, date_debut, date_fin,
    salaire_brut, brut_imposable, cotisations, retenues, total_indemnites_non_imposables, total_autres_retenues,
    arrondi, net_a_payer, salaire_net, cout_salarial, statut)
  VALUES ('${id}', '${ref}', '${EMP}', 'Kouassi Ama', '${fin.slice(0, 7)}', '${debut}', '${fin}',
    171872, 141872, 16849, 9438, 30000, 0, 1, 162435, 162435, 188721, 'brouillon');
  INSERT INTO public.bulletin_lignes (bulletin_id, numero_rubrique, libelle, gain, retenue, bloc, ordre) VALUES
    ('${id}', '150', 'Salaire de base', 141872, 0, 'imposable', 1),
    ('${id}', '469', 'C.R', 0, 8938, 'retenue', 2),
    ('${id}', '470', 'CMU (Couverture Maladie Univ.)', 0, 500, 'retenue', 3),
    ('${id}', '503', 'Indemnité de transport', 30000, 0, 'non_imposable', 4);
  ${UTILISATEUR}`;
const valider = (id: string) => erreur(`SELECT public.paie_valider_bulletin('${id}');`);

const B1 = "b0000000-0000-0000-0000-000000000001";
const B2 = "b0000000-0000-0000-0000-000000000002";
const B3 = "b0000000-0000-0000-0000-000000000003";
const B4 = "b0000000-0000-0000-0000-000000000004";
const B5 = "b0000000-0000-0000-0000-000000000005";

beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    SOCLE_SUPABASE +
      TABLES_COMPTA +
      `
    CREATE FUNCTION public.rbac3_can(_c text, _u uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
      SELECT public.has_permission(_u, _c) $$;
    CREATE FUNCTION public.is_hr(_u uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
    CREATE TABLE public.bulletins_paie (
      bulletin_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reference text, employe_id uuid,
      employe_nom text, periode text, date_bulletin date DEFAULT current_date, date_debut date, date_fin date,
      date_paiement date, mode_paiement text, pdf_url text, jours_travailles numeric DEFAULT 30,
      salaire_brut numeric, brut_imposable numeric, cotisations numeric, retenues numeric,
      total_indemnites_non_imposables numeric, total_autres_retenues numeric, arrondi numeric,
      net_a_payer numeric, salaire_net numeric, cout_salarial numeric, statut text, exercice_id uuid,
      created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
    CREATE TABLE public.bulletin_lignes (
      ligne_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      bulletin_id uuid NOT NULL REFERENCES public.bulletins_paie(bulletin_id) ON DELETE CASCADE,
      code text, numero_rubrique text, libelle text, designation text, gain numeric DEFAULT 0,
      retenue numeric DEFAULT 0, bloc text, ordre int);
    CREATE UNIQUE INDEX bulletins_paie_employe_periode_uniq
      ON public.bulletins_paie (employe_id, date_debut, date_fin) WHERE date_debut IS NOT NULL;
  `,
  );
  for (const f of [
    "_resolve_exercice_id(",
    "_journal_id(",
    "_ecriture_sync(",
    "_ecriture_ligne_sync(",
    "generate_ecriture_bulletin(",
    "_trg_bulletin_ecriture(",
  ]) {
    await db.exec(fonctionMigration(f));
  }
  await db.exec(fonctionMigration("paie_valider_bulletin(", "0110_"));
  await db.exec(`
    CREATE TRIGGER trg_ecriture_sync BEFORE INSERT OR UPDATE ON public.ecritures_comptables FOR EACH ROW EXECUTE FUNCTION public._ecriture_sync();
    CREATE TRIGGER trg_ecriture_ligne_sync BEFORE INSERT OR UPDATE ON public.ecriture_lignes FOR EACH ROW EXECUTE FUNCTION public._ecriture_ligne_sync();
    CREATE TRIGGER trg_bulletin_ecriture AFTER INSERT OR UPDATE OF statut ON public.bulletins_paie
      FOR EACH ROW EXECUTE FUNCTION public._trg_bulletin_ecriture();
  `);
  await db.exec(migration("0108_compta_integrite_ecritures.sql"));
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("avant 0110", () => {
  it("la validation comptabilise le bulletin, écriture équilibrée (661/664/658 = 422/431)", async () => {
    await db.exec(bulletin(B1, "BUL-1", "2026-01-01", "2026-01-31"));
    expect(await valider(B1)).toBeNull();
    expect(await ecrituresActives(B1)).toBe(1);
    expect(await solde("661")).toBe(171872);
    expect(await solde("422")).toBe(-162435);
    expect(await solde("431")).toBe(-(9438 + 16849));
    expect(await nombre(`SELECT sum(debit) - sum(credit) AS n FROM public.ecriture_lignes`)).toBe(
      0,
    );
  });

  it("un bulletin validé se modifie et se supprime sans toucher l'écriture", async () => {
    await db.exec(bulletin(B2, "BUL-2", "2026-02-01", "2026-02-28"));
    expect(await valider(B2)).toBeNull();
    expect(
      await erreur(
        `UPDATE public.bulletins_paie SET net_a_payer = 200000 WHERE bulletin_id = '${B2}';`,
      ),
    ).toBeNull();
    expect(
      await erreur(`DELETE FROM public.bulletins_paie WHERE bulletin_id = '${B1}';`),
    ).toBeNull();
    expect(await ecrituresActives(B1)).toBe(1);
  });
});

describe("migration 0110", () => {
  beforeAll(async () => {
    await db.exec(TECHNIQUE + migration("0110_paie_integrite_bulletins.sql"));
  });

  it("se rejoue sans erreur (idempotente)", async () => {
    expect(await erreur(TECHNIQUE + migration("0110_paie_integrite_bulletins.sql"))).toBeNull();
  });

  it("le contrôle signale le bulletin modifié et l'écriture du bulletin supprimé", async () => {
    await db.exec(UTILISATEUR);
    const r = await db.query<{ anomalie: string; bulletin_id: string }>(
      `SELECT anomalie, bulletin_id FROM public.paie_controle_ecarts() ORDER BY anomalie`,
    );
    expect(r.rows.map((x) => [x.anomalie, x.bulletin_id])).toEqual([
      ["Écriture d'un bulletin supprimé", B1],
      ["Écriture ≠ bulletin", B2],
    ]);
  });

  it("un bulletin validé ne se supprime plus, ses montants et lignes ne changent plus", async () => {
    await db.exec(bulletin(B3, "BUL-3", "2026-03-01", "2026-03-31"));
    expect(await valider(B3)).toBeNull();
    expect(await erreur(`DELETE FROM public.bulletins_paie WHERE bulletin_id = '${B3}';`)).toMatch(
      /suppression interdite/,
    );
    expect(
      await erreur(`UPDATE public.bulletins_paie SET net_a_payer = 1 WHERE bulletin_id = '${B3}';`),
    ).toMatch(/ne se modifient pas/);
    expect(
      await erreur(`UPDATE public.bulletin_lignes SET retenue = 0 WHERE bulletin_id = '${B3}';`),
    ).toMatch(/ne se modifient pas/);
    expect(await erreur(`DELETE FROM public.bulletin_lignes WHERE bulletin_id = '${B3}';`)).toMatch(
      /verrouillées/,
    );
    expect(
      await erreur(
        `UPDATE public.bulletins_paie SET statut = 'brouillon' WHERE bulletin_id = '${B3}';`,
      ),
    ).toMatch(/retour en arrière interdit/);
  });

  it("le paiement reste possible (statut, date et mode de paiement)", async () => {
    expect(
      await erreur(
        `UPDATE public.bulletins_paie SET statut = 'paye', date_paiement = '2026-04-02', mode_paiement = 'virement'
          WHERE bulletin_id = '${B3}';`,
      ),
    ).toBeNull();
    expect(
      await erreur(`SELECT public.paie_annuler_bulletin('${B3}', 'Erreur de salaire');`),
    ).toMatch(/payé/);
  });

  it("le statut validé ne se pose pas directement, un brouillon se supprime", async () => {
    await db.exec(bulletin(B4, "BUL-4", "2026-04-01", "2026-04-30"));
    expect(
      await erreur(
        `UPDATE public.bulletins_paie SET statut = 'valide' WHERE bulletin_id = '${B4}';`,
      ),
    ).toMatch(/Valider/);
    expect(await ecrituresActives(B4)).toBe(0);
    expect(
      await erreur(`DELETE FROM public.bulletins_paie WHERE bulletin_id = '${B4}';`),
    ).toBeNull();
    expect(
      await nombre(`SELECT count(*) AS n FROM public.bulletin_lignes WHERE bulletin_id = '${B4}'`),
    ).toBe(0);
  });

  it("refuse une période qui chevauche un bulletin existant du même employé", async () => {
    expect(await erreur(bulletin(B4, "BUL-4", "2026-03-15", "2026-04-14"))).toMatch(
      /BUL-3.*couvre déjà/,
    );
  });

  it("annulation : motif requis, droit vérifié, écriture contre-passée, période refaisable", async () => {
    await db.exec(bulletin(B4, "BUL-4", "2026-04-01", "2026-04-30"));
    expect(await valider(B4)).toBeNull();
    expect(await erreur(`SELECT public.paie_annuler_bulletin('${B4}', '');`)).toMatch(/Motif/);
    await db.exec(`INSERT INTO public.permissions_refusees VALUES ('rh.modifier');`);
    expect(
      await erreur(`SELECT public.paie_annuler_bulletin('${B4}', 'Erreur de salaire');`),
    ).toMatch(/Droit insuffisant/);
    await db.exec(`DELETE FROM public.permissions_refusees;`);
    const avant422 = await solde("422");
    expect(
      await erreur(`SELECT public.paie_annuler_bulletin('${B4}', 'Erreur de salaire');`),
    ).toBeNull();
    expect(await ecrituresActives(B4)).toBe(0);
    expect(await solde("422")).toBe(avant422 + 162435);
    const b = await db.query<{ statut: string; motif_annulation: string; annule_par: string }>(
      `SELECT statut, motif_annulation, annule_par FROM public.bulletins_paie WHERE bulletin_id = '${B4}'`,
    );
    expect(b.rows[0]).toEqual({
      statut: "annule",
      motif_annulation: "Erreur de salaire",
      annule_par: "00000000-0000-0000-0000-000000000001",
    });
    expect(
      await erreur(`UPDATE public.bulletins_paie SET pdf_url = 'x' WHERE bulletin_id = '${B4}';`),
    ).toMatch(/annulé/);
    expect(await erreur(bulletin(B5, "BUL-5", "2026-04-01", "2026-04-30"))).toBeNull();
    expect(await valider(B5)).toBeNull();
    expect(await ecrituresActives(B5)).toBe(1);
  });

  it("un bulletin sans lignes ne se valide pas", async () => {
    await db.exec(
      TECHNIQUE +
        `INSERT INTO public.bulletins_paie (reference, employe_id, date_debut, date_fin, salaire_brut, statut)
           VALUES ('BUL-VIDE', '${EMP}', '2026-05-01', '2026-05-31', 1000, 'brouillon');` +
        UTILISATEUR,
    );
    expect(
      await erreur(
        `SELECT public.paie_valider_bulletin(bulletin_id) FROM public.bulletins_paie WHERE reference = 'BUL-VIDE';`,
      ),
    ).toMatch(/sans lignes/);
  });
});
