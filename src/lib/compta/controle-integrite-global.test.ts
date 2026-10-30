// @vitest-environment node
// Contrôle d'intégrité entre modules (migration 0111), sur un vrai PostgreSQL (PGlite).
// Les générateurs d'écritures (factures, paiements, achats) et les migrations 0108 à 0110
// sont repris tels que définis par le projet ; les états anormaux (anciennes données,
// déclencheur absent) sont reproduits en désactivant ponctuellement un déclencheur.

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
const controle = async () =>
  (
    await db.query<{ domaine: string; anomalie: string; reference: string | null }>(
      `SELECT domaine, anomalie, reference FROM public.controle_integrite_global()
        ORDER BY domaine, anomalie, reference`,
    )
  ).rows.map((r) => [r.domaine, r.anomalie, r.reference]);

const F = (n: number) => `aaaaaaaa-0000-0000-0000-00000000000${n}`;
const P = (n: number) => `bbbbbbbb-0000-0000-0000-00000000000${n}`;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    SOCLE_SUPABASE +
      TABLES_COMPTA +
      `
    CREATE FUNCTION public.rbac3_can(_c text, _u uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
      SELECT public.has_permission(_u, _c) $$;
    CREATE FUNCTION public.is_hr(_u uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
    CREATE TABLE public.factures (
      facture_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reference text, client_nom text,
      date_facture date DEFAULT current_date, montant_total numeric, statut text DEFAULT 'emise', exercice_id uuid);
    CREATE TABLE public.paiements (
      paiement_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reference text, facture_id uuid,
      client_nom text, date_paiement date DEFAULT current_date, montant numeric,
      mode_paiement text DEFAULT 'especes', statut text DEFAULT 'en_attente', exercice_id uuid);
    CREATE TABLE public.achats (
      achat_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reference text, fournisseur_nom text,
      date_achat date DEFAULT current_date, montant numeric, statut text DEFAULT 'brouillon', exercice_id uuid);
    CREATE TABLE public.transactions (
      transaction_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reference text, type text,
      categorie text, libelle text, montant numeric, mode_paiement text, statut text DEFAULT 'valide',
      date_transaction date DEFAULT current_date, commande_id uuid, notes text, exercice_id uuid,
      created_by uuid, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
    CREATE TABLE public.bulletins_paie (
      bulletin_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reference text, employe_id uuid,
      employe_nom text, periode text, date_debut date, date_fin date, date_paiement date,
      mode_paiement text, pdf_url text, salaire_brut numeric, cotisations numeric, retenues numeric,
      total_autres_retenues numeric, arrondi numeric, net_a_payer numeric, statut text,
      exercice_id uuid, updated_at timestamptz DEFAULT now());
    CREATE TABLE public.bulletin_lignes (
      ligne_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      bulletin_id uuid NOT NULL REFERENCES public.bulletins_paie(bulletin_id) ON DELETE CASCADE,
      libelle text, gain numeric DEFAULT 0, retenue numeric DEFAULT 0, bloc text);
  `,
  );
  for (const f of [
    "_resolve_exercice_id(",
    "_journal_id(",
    "_ecriture_sync(",
    "_ecriture_ligne_sync(",
    "_compte_mode_paiement(",
    "generate_ecriture_facture(_facture_id",
    "generate_ecriture_paiement(_paiement_id",
    "generate_ecriture_achat(",
    "_trg_achat_ecriture(",
  ]) {
    await db.exec(fonctionMigration(f));
  }
  await db.exec(`
    CREATE TRIGGER trg_ecriture_sync BEFORE INSERT OR UPDATE ON public.ecritures_comptables FOR EACH ROW EXECUTE FUNCTION public._ecriture_sync();
    CREATE TRIGGER trg_ecriture_ligne_sync BEFORE INSERT OR UPDATE ON public.ecriture_lignes FOR EACH ROW EXECUTE FUNCTION public._ecriture_ligne_sync();
    CREATE TRIGGER trg_achats_ecriture AFTER INSERT OR UPDATE OR DELETE ON public.achats FOR EACH ROW EXECUTE FUNCTION public._trg_achat_ecriture();
  `);
  for (const m of [
    "0108_compta_integrite_ecritures.sql",
    "0109_finances_integrite.sql",
    "0110_paie_integrite_bulletins.sql",
    "0111_controle_integrite_global.sql",
  ]) {
    await db.exec(TECHNIQUE + migration(m));
  }
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("contrôle d'intégrité global (0111)", () => {
  it("se rejoue sans erreur (idempotente)", async () => {
    expect(await erreur(TECHNIQUE + migration("0111_controle_integrite_global.sql"))).toBeNull();
  });

  it("aucune anomalie quand chaque pièce a son écriture", async () => {
    await db.exec(
      TECHNIQUE +
        `
      INSERT INTO public.factures (facture_id, reference, client_nom, date_facture, montant_total)
        VALUES ('${F(1)}', 'FAC-1', 'Client', '2026-03-02', 5000);
      INSERT INTO public.paiements (paiement_id, reference, facture_id, date_paiement, montant, statut)
        VALUES ('${P(1)}', 'PAY-1', '${F(1)}', '2026-03-03', 5000, 'valide');
      INSERT INTO public.achats (reference, fournisseur_nom, date_achat, montant, statut)
        VALUES ('ACH-1', 'Papeterie', '2026-03-04', 3000, 'confirme');
      INSERT INTO public.transactions (reference, type, categorie, montant)
        VALUES ('T-1', 'depense', 'loyer', 100000);` +
        UTILISATEUR,
    );
    expect(await controle()).toEqual([]);
  });

  it("signale les écarts entre pièces et écritures, sans rien corriger", async () => {
    // Anciennes données : pièces modifiées, créées ou supprimées sans passer par les déclencheurs.
    await db.exec(
      TECHNIQUE +
        `
      ALTER TABLE public.factures DISABLE TRIGGER USER;
      ALTER TABLE public.paiements DISABLE TRIGGER USER;
      UPDATE public.factures SET montant_total = 6000 WHERE facture_id = '${F(1)}';
      INSERT INTO public.paiements (paiement_id, reference, date_paiement, montant, statut)
        VALUES ('${P(2)}', 'PAY-SANS', '2026-03-05', 700, 'valide');
      ALTER TABLE public.factures ENABLE TRIGGER USER;
      ALTER TABLE public.paiements ENABLE TRIGGER USER;
      INSERT INTO public.factures (facture_id, reference, date_facture, montant_total)
        VALUES ('${F(3)}', 'FAC-SUPPR', '2026-03-06', 900);
      ALTER TABLE public.factures DISABLE TRIGGER USER;
      DELETE FROM public.factures WHERE facture_id = '${F(3)}';
      ALTER TABLE public.factures ENABLE TRIGGER USER;
      INSERT INTO public.ecritures_comptables (reference, date_ecriture, libelle, montant, statut)
        VALUES ('OD-BANCALE', '2026-03-07', 'Saisie ancienne', 100, 'brouillon');
      INSERT INTO public.ecriture_lignes (ecriture_id, compte, debit, credit)
        SELECT ecriture_id, '601', 100, 0 FROM public.ecritures_comptables WHERE reference = 'OD-BANCALE';
      INSERT INTO public.transactions (reference, type, categorie, montant)
        VALUES ('T-SAL', 'depense', 'salaire', 250000);` +
        UTILISATEUR,
    );
    const nbEcritures = (await db.query(`SELECT 1 FROM public.ecritures_comptables`)).rows.length;
    const anomalies = await controle();
    expect(anomalies).toHaveLength(5);
    expect(anomalies).toEqual(
      expect.arrayContaining([
        ["Comptabilité", "Écriture déséquilibrée", "OD-BANCALE"],
        [
          "Finances",
          "Transaction « salaire » à rapprocher des bulletins (double comptage possible)",
          "T-SAL",
        ],
        ["Ventes et encaissements", "Écriture active d'une pièce supprimée", null],
        ["Ventes et encaissements", "Pièce validée sans écriture", "PAY-SANS"],
        ["Ventes et encaissements", "Écriture ≠ pièce", "FAC-1"],
      ]),
    );
    // Lecture seule : aucune écriture créée ni modifiée par le contrôle.
    expect((await db.query(`SELECT 1 FROM public.ecritures_comptables`)).rows.length).toBe(
      nbEcritures,
    );
  });

  it("un achat annulé est contre-passé, donc absent du contrôle", async () => {
    expect(
      await erreur(`UPDATE public.achats SET statut = 'annule' WHERE reference = 'ACH-1';`),
    ).toBeNull();
    expect((await controle()).filter((r) => r[0] === "Achats")).toEqual([]);
  });

  it("réservé au droit comptabilite.voir", async () => {
    await db.exec(`INSERT INTO public.permissions_refusees VALUES ('comptabilite.voir');`);
    expect(await erreur(`SELECT * FROM public.controle_integrite_global();`)).toMatch(
      /comptabilite\.voir/,
    );
    await db.exec(`DELETE FROM public.permissions_refusees;`);
  });

  it("le solde fournisseur ignore les transactions annulées ou en attente", async () => {
    await db.exec(
      TECHNIQUE +
        `
      CREATE TABLE IF NOT EXISTS public.soldes_ouverture_fournisseurs (fournisseur_id uuid, exercice_id uuid, montant numeric);
      ALTER TABLE public.achats ADD COLUMN IF NOT EXISTS fournisseur_id uuid;
      ALTER TABLE public.achats ADD COLUMN IF NOT EXISTS montant_total numeric;
      INSERT INTO public.achats (reference, fournisseur_id, montant, montant_total, statut, exercice_id)
        SELECT 'ACH-F', 'cccccccc-0000-0000-0000-000000000001', 1000, 1000, 'brouillon', exercice_id
          FROM public.exercices_comptables WHERE libelle = '2026';
      INSERT INTO public.transactions (reference, type, montant, statut, exercice_id)
        SELECT r, 'depense', 400, s, exercice_id
          FROM public.exercices_comptables, (VALUES ('V', 'valide'), ('A', 'en_attente')) x(s0, s),
               LATERAL (SELECT 'PF-' || s0 || '-cccccccc-0000-0000-0000-000000000001' AS r) y
         WHERE libelle = '2026';` +
        UTILISATEUR,
    );
    const r = await db.query<{ s: string }>(
      `SELECT public.calcul_solde_fournisseur('cccccccc-0000-0000-0000-000000000001',
         (SELECT exercice_id FROM public.exercices_comptables WHERE libelle = '2026')) AS s`,
    );
    expect(Number(r.rows[0].s)).toBe(600);
  });
});
