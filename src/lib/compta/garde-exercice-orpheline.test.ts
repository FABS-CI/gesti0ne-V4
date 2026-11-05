// @vitest-environment node
// Migration 0118 : retrait du garde-fou « trg_garde_exercice_clos » appliqué à la base
// le 03/11/2026 par une migration Lovable restée hors du dépôt (branche lovable-sync).
// L'état de la base réelle est reproduit : migrations du dépôt, puis ce déclencheur.

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { TECHNIQUE, UTILISATEUR, fonctionMigration, migration } from "@/test/pg-migrations";

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
const solde = (compte: string) =>
  nombre(
    `SELECT coalesce(sum(debit - credit), 0) AS n FROM public.ecriture_lignes WHERE compte = '${compte}'`,
  );

// Copie du déclencheur créé dans la base par la migration Lovable hors dépôt
// (lovable-sync, commit a0037339, « 0108_compta_garde_exercice_et_saisie_atomique »).
const GARDE_ORPHELINE = `
CREATE OR REPLACE FUNCTION public._ecriture_garde_exercice_clos()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ex uuid; v_statut text;
BEGIN
  IF TG_TABLE_NAME = 'ecriture_lignes' THEN
    SELECT exercice_id INTO v_ex FROM public.ecritures_comptables
     WHERE ecriture_id = COALESCE(NEW.ecriture_id, OLD.ecriture_id);
  ELSE
    v_ex := CASE WHEN TG_OP = 'DELETE' THEN OLD.exercice_id ELSE NEW.exercice_id END;
    IF TG_OP = 'UPDATE' AND OLD.exercice_id IS DISTINCT FROM NEW.exercice_id THEN
      SELECT statut INTO v_statut FROM public.exercices_comptables WHERE exercice_id = OLD.exercice_id;
      IF lower(coalesce(v_statut,'')) LIKE 'clo%' THEN
        RAISE EXCEPTION 'Exercice clôturé : écriture non modifiable' USING ERRCODE='42501';
      END IF;
    END IF;
  END IF;
  SELECT statut INTO v_statut FROM public.exercices_comptables WHERE exercice_id = v_ex;
  IF lower(coalesce(v_statut,'')) LIKE 'clo%' THEN
    RAISE EXCEPTION 'Exercice clôturé : aucune écriture ne peut y être ajoutée, modifiée ou supprimée' USING ERRCODE='42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
DROP TRIGGER IF EXISTS trg_garde_exercice_clos ON public.ecritures_comptables;
CREATE TRIGGER trg_garde_exercice_clos BEFORE INSERT OR UPDATE OR DELETE ON public.ecritures_comptables
FOR EACH ROW EXECUTE FUNCTION public._ecriture_garde_exercice_clos();
DROP TRIGGER IF EXISTS trg_garde_exercice_clos ON public.ecriture_lignes;
CREATE TRIGGER trg_garde_exercice_clos BEFORE INSERT OR UPDATE OR DELETE ON public.ecriture_lignes
FOR EACH ROW EXECUTE FUNCTION public._ecriture_garde_exercice_clos();
CREATE OR REPLACE FUNCTION public.creer_ecriture_manuelle(
  _date date, _journal text, _reference text, _libelle text, _lignes jsonb)
RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
`;

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
    await db.exec(fonctionMigration(`${f}(`));
  }
  await db.exec(`
    CREATE TRIGGER trg_ecriture_sync BEFORE INSERT OR UPDATE ON public.ecritures_comptables FOR EACH ROW EXECUTE FUNCTION public._ecriture_sync();
    CREATE TRIGGER trg_ecritures_updated_at BEFORE UPDATE ON public.ecritures_comptables FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    CREATE TRIGGER trg_ecriture_ligne_sync BEFORE INSERT OR UPDATE ON public.ecriture_lignes FOR EACH ROW EXECUTE FUNCTION public._ecriture_ligne_sync();
    CREATE TRIGGER trg_facture_ecriture AFTER INSERT OR UPDATE OR DELETE ON public.factures FOR EACH ROW EXECUTE FUNCTION public._trg_facture_ecriture();
    INSERT INTO public.exercices_comptables (libelle, date_debut, date_fin, statut, is_actif)
      VALUES ('2025', '2025-01-01', '2025-12-31', 'ouvert', false),
             ('2026', '2026-01-01', '2026-12-31', 'actif', true);
  `);
  await db.exec(migration("0108_compta_integrite_ecritures.sql"));
  // Facture de 2025 comptabilisée, puis exercice 2025 clôturé.
  await db.exec(`
    INSERT INTO public.factures (reference, client_nom, date_facture, montant_total)
      VALUES ('FAC-2025', 'Client', '2025-06-10', 5000);
    UPDATE public.exercices_comptables SET statut = 'cloture', cloture_le = now() WHERE libelle = '2025';
  `);
  // État de la base réelle : garde-fou orphelin présent.
  await db.exec(GARDE_ORPHELINE);
  await db.exec(UTILISATEUR);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("migration 0118 : garde-fou orphelin trg_garde_exercice_clos", () => {
  it("avant 0118 : annuler une facture d'un exercice clôturé échoue", async () => {
    expect(await solde("411")).toBe(5000);
    expect(
      await erreur(`UPDATE public.factures SET statut = 'annulee' WHERE reference = 'FAC-2025';`),
    ).toMatch(/Exercice clôturé/);
    expect(await solde("411")).toBe(5000);
  });

  it("0118 retire le déclencheur et creer_ecriture_manuelle, et se rejoue sans erreur", async () => {
    const m = migration("0118_retrait_garde_exercice_orpheline.sql");
    expect(await erreur(TECHNIQUE + m + m + UTILISATEUR)).toBeNull();
    expect(
      await nombre(`SELECT count(*) AS n FROM pg_trigger WHERE tgname = 'trg_garde_exercice_clos'`),
    ).toBe(0);
    expect(
      await nombre(
        `SELECT count(*) AS n FROM pg_proc WHERE proname IN ('creer_ecriture_manuelle', '_ecriture_garde_exercice_clos')`,
      ),
    ).toBe(0);
  });

  it("après 0118 : l'annulation passe par une contre-passation datée dans l'exercice ouvert", async () => {
    expect(
      await erreur(`UPDATE public.factures SET statut = 'annulee' WHERE reference = 'FAC-2025';`),
    ).toBeNull();
    expect(await solde("411")).toBe(0);
    const r = await db.query<{ clos: boolean; ok: boolean }>(`
      SELECT oe.statut = 'cloture' AS clos,
             o.contrepassee_par = c.ecriture_id AND ce.statut <> 'cloture' AS ok
        FROM public.ecritures_comptables o
        JOIN public.ecritures_comptables c ON c.contrepassation_de = o.ecriture_id
        JOIN public.exercices_comptables oe ON oe.exercice_id = o.exercice_id
        JOIN public.exercices_comptables ce ON ce.exercice_id = c.exercice_id`);
    expect(r.rows).toEqual([{ clos: true, ok: true }]);
  });

  it("après 0118 : l'exercice clôturé reste protégé par les garde-fous du dépôt", async () => {
    expect(
      await erreur(
        `INSERT INTO public.ecritures_comptables (reference, date_ecriture, statut) VALUES ('CLOS', '2025-07-01', 'valide');`,
      ),
    ).toMatch(/clôturé/);
    expect(
      await erreur(
        `UPDATE public.ecritures_comptables SET libelle = 'x' WHERE contrepassee_le IS NOT NULL;`,
      ),
    ).toMatch(/clôturé/);
    expect(
      await erreur(
        `UPDATE public.ecriture_lignes SET debit = debit + 1 WHERE ecriture_id IN (SELECT ecriture_id FROM public.ecritures_comptables WHERE contrepassee_le IS NOT NULL);`,
      ),
    ).toMatch(/clôturé/);
  });
});
