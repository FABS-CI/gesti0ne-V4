// @vitest-environment node
// Intégrité des finances (migration 0109), sur un vrai PostgreSQL (PGlite) : une seule
// comptabilisation par paiement et par facture, historique des transactions.
// L'état d'avant 0109 est reconstitué avec les anciens déclencheurs (juin) et les
// nouveaux (juillet), tels que définis par les migrations, pour reproduire le doublon.

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
const nombre = async (sql: string) => Number((await db.query<{ n: string }>(sql)).rows[0].n);
const ecrituresActives = (piece: string) =>
  nombre(`SELECT count(*) AS n FROM public.ecritures_comptables
           WHERE (piece_ref = '${piece}' OR (piece_ref IS NULL AND source_id::text = split_part('${piece}', ':', 2)))
             AND contrepassee_le IS NULL AND contrepassation_de IS NULL`);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    SOCLE_SUPABASE +
      TABLES_COMPTA +
      `
    CREATE TABLE public.factures (
      facture_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reference text, client_nom text,
      date_facture date DEFAULT current_date, montant_total numeric, statut text DEFAULT 'emise', exercice_id uuid);
    CREATE TABLE public.paiements (
      paiement_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reference text, facture_id uuid,
      client_nom text, date_paiement date DEFAULT current_date, montant numeric,
      mode_paiement text DEFAULT 'especes', statut text DEFAULT 'en_attente', exercice_id uuid);
    CREATE TABLE public.transactions (
      transaction_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reference text, type text,
      categorie text, libelle text, montant numeric, mode_paiement text, statut text DEFAULT 'valide',
      date_transaction date DEFAULT current_date, commande_id uuid, notes text, exercice_id uuid,
      created_by uuid, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
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
  ]) {
    await db.exec(fonctionMigration(f));
  }
  // Anciennes versions « déclencheur » (juin) et versions actuelles d'avant 0109.
  await db.exec(fonctionMigration("generate_ecriture_paiement()"));
  await db.exec(fonctionMigration("generate_ecriture_facture()"));
  await db.exec(fonctionMigration("_trg_paiement_ecriture(", "0109_"));
  await db.exec(fonctionMigration("_trg_facture_ecriture(", "0109_"));
  await db.exec(`
    CREATE TRIGGER trg_ecriture_sync BEFORE INSERT OR UPDATE ON public.ecritures_comptables FOR EACH ROW EXECUTE FUNCTION public._ecriture_sync();
    CREATE TRIGGER trg_ecriture_ligne_sync BEFORE INSERT OR UPDATE ON public.ecriture_lignes FOR EACH ROW EXECUTE FUNCTION public._ecriture_ligne_sync();
    CREATE TRIGGER trg_paiement_ecriture AFTER INSERT ON public.paiements FOR EACH ROW EXECUTE FUNCTION public.generate_ecriture_paiement();
    CREATE TRIGGER trg_paiements_ecriture AFTER INSERT OR UPDATE OR DELETE ON public.paiements FOR EACH ROW EXECUTE FUNCTION public._trg_paiement_ecriture();
    CREATE TRIGGER trg_facture_ecriture AFTER INSERT ON public.factures FOR EACH ROW EXECUTE FUNCTION public.generate_ecriture_facture();
    CREATE TRIGGER trg_factures_ecriture AFTER INSERT OR UPDATE OR DELETE ON public.factures FOR EACH ROW EXECUTE FUNCTION public._trg_facture_ecriture();
  `);
  await db.exec(migration("0108_compta_integrite_ecritures.sql"));
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("avant 0109 : anciens et nouveaux déclencheurs ensemble", () => {
  it("comptabilisent deux fois un paiement et une facture", async () => {
    await db.exec(
      TECHNIQUE +
        `
      INSERT INTO public.factures (facture_id, reference, client_nom, date_facture, montant_total)
        VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'FAC-AVANT', 'Client', '2026-03-02', 5000);
      INSERT INTO public.paiements (paiement_id, reference, facture_id, client_nom, date_paiement, montant, mode_paiement, statut)
        VALUES ('bbbbbbbb-0000-0000-0000-000000000001', 'PAY-AVANT', 'aaaaaaaa-0000-0000-0000-000000000001', 'Client', '2026-03-03', 5000, 'especes', 'valide');`,
    );
    expect(await ecrituresActives("FACT:aaaaaaaa-0000-0000-0000-000000000001")).toBe(2);
    expect(
      await nombre(
        `SELECT count(*) AS n FROM public.ecritures_comptables WHERE libelle LIKE '%PAY-AVANT%' OR piece_ref = 'PAI:bbbbbbbb-0000-0000-0000-000000000001'`,
      ),
    ).toBe(2);
  });
});

describe("migration 0109", () => {
  beforeAll(async () => {
    await db.exec(TECHNIQUE + migration("0109_finances_integrite.sql"));
  });

  it("se rejoue sans erreur (idempotente)", async () => {
    expect(await erreur(TECHNIQUE + migration("0109_finances_integrite.sql"))).toBeNull();
  });

  it("le contrôle signale la facture et le paiement comptabilisés deux fois avant la correction", async () => {
    await db.exec(UTILISATEUR);
    const r = await db.query<{ type_piece: string; reference: string; nb_ecritures: string }>(
      `SELECT type_piece, reference, nb_ecritures FROM public.compta_pieces_comptabilisees_plusieurs_fois()
        ORDER BY type_piece`,
    );
    expect(r.rows.map((x) => [x.type_piece, x.reference, Number(x.nb_ecritures)])).toEqual([
      ["facture", "FAC-AVANT", 2],
      ["paiement", "PAY-AVANT", 2],
    ]);
  });

  it("un nouveau paiement et une nouvelle facture ne sont comptabilisés qu'une fois", async () => {
    await db.exec(
      UTILISATEUR +
        `
      INSERT INTO public.factures (facture_id, reference, client_nom, date_facture, montant_total)
        VALUES ('aaaaaaaa-0000-0000-0000-000000000002', 'FAC-APRES', 'Client', '2026-03-04', 7000);
      INSERT INTO public.paiements (paiement_id, reference, facture_id, client_nom, date_paiement, montant, mode_paiement, statut)
        VALUES ('bbbbbbbb-0000-0000-0000-000000000002', 'PAY-APRES', 'aaaaaaaa-0000-0000-0000-000000000002', 'Client', '2026-03-05', 7000, 'virement', 'valide');`,
    );
    expect(await ecrituresActives("FACT:aaaaaaaa-0000-0000-0000-000000000002")).toBe(1);
    expect(await ecrituresActives("PAI:bbbbbbbb-0000-0000-0000-000000000002")).toBe(1);
  });

  it("dé-valider un paiement le contre-passe (plus d'écriture active, historique conservé)", async () => {
    expect(
      await erreur(`UPDATE public.paiements SET statut = 'rejete' WHERE reference = 'PAY-APRES';`),
    ).toBeNull();
    expect(await ecrituresActives("PAI:bbbbbbbb-0000-0000-0000-000000000002")).toBe(0);
    expect(
      await nombre(
        `SELECT count(*) AS n FROM public.ecritures_comptables WHERE piece_ref LIKE '%PAI:bbbbbbbb-0000-0000-0000-000000000002'`,
      ),
    ).toBe(2);
  });
});

describe("transactions : montant positif et historique", () => {
  it("refuse un montant nul ou négatif", async () => {
    expect(
      await erreur(
        `INSERT INTO public.transactions (reference, type, montant) VALUES ('T-0', 'depense', 0);`,
      ),
    ).toMatch(/transactions_montant_positif/);
    expect(
      await erreur(
        `INSERT INTO public.transactions (reference, type, montant) VALUES ('T-N', 'depense', -50);`,
      ),
    ).toMatch(/transactions_montant_positif/);
  });

  it("une transaction validée ne se supprime pas et ne change plus de montant", async () => {
    await db.exec(
      `INSERT INTO public.transactions (reference, type, categorie, libelle, montant, statut) VALUES ('T-1', 'depense', 'loyer', 'Loyer', 100000, 'valide');`,
    );
    expect(await erreur(`DELETE FROM public.transactions WHERE reference = 'T-1';`)).toMatch(
      /suppression interdite/,
    );
    expect(
      await erreur(`UPDATE public.transactions SET montant = 1 WHERE reference = 'T-1';`),
    ).toMatch(/ne changent plus/);
    expect(
      await erreur(
        `UPDATE public.transactions SET libelle = 'Loyer mars', notes = 'précision' WHERE reference = 'T-1';`,
      ),
    ).toBeNull();
  });

  it("une transaction validée s'annule, puis ne bouge plus", async () => {
    expect(
      await erreur(`UPDATE public.transactions SET statut = 'annule' WHERE reference = 'T-1';`),
    ).toBeNull();
    expect(
      await erreur(`UPDATE public.transactions SET statut = 'valide' WHERE reference = 'T-1';`),
    ).toMatch(/annulée/);
    expect(
      await nombre(`SELECT count(*) AS n FROM public.transactions WHERE reference = 'T-1'`),
    ).toBe(1);
  });

  it("une transaction en attente peut encore être supprimée", async () => {
    await db.exec(
      `INSERT INTO public.transactions (reference, type, montant, statut) VALUES ('T-2', 'recette', 500, 'en_attente');`,
    );
    expect(await erreur(`DELETE FROM public.transactions WHERE reference = 'T-2';`)).toBeNull();
  });
});
