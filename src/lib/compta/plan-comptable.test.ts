// @vitest-environment node
// Plan comptable (migration 0113), sur un vrai PostgreSQL (PGlite) : référentiel,
// comptes absents du plan, gestion protégée, contrôle de la saisie manuelle.

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
/** Saisie acceptée avant 0113 avec un compte inconnu du plan. */
let saisieAvant: string | null;

async function erreur(sql: string): Promise<string | null> {
  try {
    await db.exec(sql);
    return null;
  } catch (e) {
    await db.exec("ROLLBACK").catch(() => undefined);
    return (e as Error).message;
  }
}

const saisie = (compte: string, libelle = "Saisie") => `
  SELECT public.compta_saisir_ecriture('2026-03-10', 'OD', NULL, '${libelle}',
    '[{"compte": "${compte}", "compte_libelle": "Libellé libre", "debit": 100, "credit": 0},
      {"compte": "521", "debit": 0, "credit": 100}]'::jsonb);`;

type Compte = {
  numero: string;
  libelle: string;
  classe: number | null;
  parent_numero: string | null;
  actif: boolean;
  dans_plan: boolean;
  nb_lignes: number;
  total_debit: string;
};
const plan = async () =>
  (await db.query<Compte>(`SELECT * FROM public.compta_plan_comptable()`)).rows;
const compte = async (n: string) => (await plan()).find((c) => c.numero === n);
const idCompte = (n: string) =>
  `(SELECT compte_id FROM public.plan_comptable WHERE numero = '${n}')`;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    SOCLE_SUPABASE +
      TABLES_COMPTA +
      `
    CREATE TABLE public.plan_comptable (
      compte_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), numero text UNIQUE NOT NULL,
      libelle text NOT NULL, classe integer, type text, parent_numero text,
      actif boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
    -- Plan d'origine (juillet) : 7 comptes.
    INSERT INTO public.plan_comptable (numero, libelle, classe, type) VALUES
      ('411', 'Clients', 4, 'actif'), ('401', 'Fournisseurs', 4, 'passif'),
      ('701', 'Ventes de marchandises', 7, 'produit'), ('601', 'Achats de marchandises', 6, 'charge'),
      ('571', 'Caisse', 5, 'actif'), ('521', 'Banque', 5, 'actif'),
      ('585', 'Virements internes / Mobile Money', 5, 'actif');
  `,
  );
  for (const f of [
    "_resolve_exercice_id(",
    "_ecriture_sync(",
    "_ecriture_ligne_sync(",
    "_journal_id(",
  ]) {
    await db.exec(fonctionMigration(f));
  }
  await db.exec(`
    CREATE TRIGGER trg_ecriture_sync BEFORE INSERT OR UPDATE ON public.ecritures_comptables FOR EACH ROW EXECUTE FUNCTION public._ecriture_sync();
    CREATE TRIGGER trg_ecriture_ligne_sync BEFORE INSERT OR UPDATE ON public.ecriture_lignes FOR EACH ROW EXECUTE FUNCTION public._ecriture_ligne_sync();
  `);
  await db.exec(TECHNIQUE + migration("0108_compta_integrite_ecritures.sql"));

  // Avant 0113 : un compte inconnu (faute de frappe) est accepté, et la paie écrit sur
  // des comptes absents du plan.
  await db.exec(UTILISATEUR);
  saisieAvant = await erreur(saisie("6999", "Faute de frappe"));
  await db.exec(
    UTILISATEUR +
      `
    WITH e AS (INSERT INTO public.ecritures_comptables (reference, date_ecriture, libelle, statut, piece_ref)
               VALUES ('BUL-1', '2026-02-28', 'Paie février', 'valide', 'BUL:x') RETURNING ecriture_id)
    INSERT INTO public.ecriture_lignes (ecriture_id, compte, compte_libelle, debit, credit)
    SELECT e.ecriture_id, v.c, v.l, v.d, v.k FROM e, (VALUES
      ('661', 'Salaires bruts', 300000::numeric, 0::numeric), ('422', 'Net à payer', 0, 250000),
      ('4711', 'Avance diverse', 0, 50000)) v(c, l, d, k);
    WITH e AS (INSERT INTO public.ecritures_comptables (reference, date_ecriture, libelle, statut)
               VALUES ('OD-1', '2026-03-01', 'Avance', 'valide') RETURNING ecriture_id)
    INSERT INTO public.ecriture_lignes (ecriture_id, compte, compte_libelle, debit, credit)
    SELECT e.ecriture_id, v.c, v.l, v.d, v.k FROM e, (VALUES
      ('4711', 'Avance diverse', 20000::numeric, 0::numeric), ('4711', 'Autre libellé', 0, 0),
      ('571', 'Caisse', 0, 20000)) v(c, l, d, k);
  `,
  );
  await db.exec(TECHNIQUE + migration("0113_plan_comptable.sql") + UTILISATEUR);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("avant 0113 : défaut reproduit", () => {
  it("la saisie manuelle acceptait un compte absent du plan", () => {
    expect(saisieAvant).toBeNull();
  });
});

describe("référentiel (0113)", () => {
  it("ajoute classes, comptes principaux et comptes de l'ERP sans toucher aux libellés existants", async () => {
    expect((await compte("6"))?.libelle).toBe("Comptes de charges des activités ordinaires");
    expect((await compte("42"))?.libelle).toBe("Personnel");
    expect((await compte("661"))?.dans_plan).toBe(true);
    expect((await compte("521"))?.libelle).toBe("Banque"); // libellé existant conservé
    expect((await compte("411"))?.parent_numero).toBe("41");
    expect((await compte("41"))?.parent_numero).toBe("4");
    for (const n of [
      "411",
      "701",
      "401",
      "601",
      "571",
      "521",
      "585",
      "421",
      "422",
      "431",
      "447",
      "658",
      "661",
      "664",
      "758",
    ]) {
      expect((await compte(n))?.dans_plan, n).toBe(true);
    }
  });

  it("liste les comptes utilisés absents du plan, avec leurs mouvements", async () => {
    const c = await compte("4711");
    expect(c).toMatchObject({ dans_plan: false, classe: 4, parent_numero: "47" });
    expect(Number(c!.nb_lignes)).toBe(3);
    expect(Number(c!.total_debit)).toBe(20000);
    expect(Number((await compte("661"))!.total_debit)).toBe(300000);
  });

  it("ajoute les comptes absents avec leur libellé le plus fréquent", async () => {
    const r = await db.query<{ n: number }>(`SELECT public.compta_plan_importer_absents() AS n`);
    // 4711 et 6999 (la saisie fautive d'avant 0113).
    expect(r.rows[0].n).toBe(2);
    expect(await compte("4711")).toMatchObject({ dans_plan: true, libelle: "Avance diverse" });
    expect((await plan()).filter((c) => !c.dans_plan)).toEqual([]);
  });

  it("se rejoue sans erreur et sans doublon (idempotente)", async () => {
    const n = (await plan()).length;
    expect(await erreur(TECHNIQUE + migration("0113_plan_comptable.sql") + UTILISATEUR)).toBeNull();
    expect((await plan()).length).toBe(n);
  });
});

describe("gestion des comptes (0113)", () => {
  it("crée un sous-compte rattaché à son parent, et devient le parent des comptes plus longs", async () => {
    await db.exec(
      `SELECT public.compta_plan_enregistrer(NULL, '4111', 'Clients, ventes de livres');`,
    );
    expect((await compte("4111"))?.parent_numero).toBe("411");
    await db.exec(
      `SELECT public.compta_plan_enregistrer(NULL, '471', 'Débiteurs et créditeurs divers');`,
    );
    expect((await compte("4711"))?.parent_numero).toBe("471");
  });

  it("refuse un numéro invalide, un doublon, un libellé vide", async () => {
    expect(await erreur(`SELECT public.compta_plan_enregistrer(NULL, '0411', 'Essai');`)).toMatch(
      /invalide/,
    );
    expect(await erreur(`SELECT public.compta_plan_enregistrer(NULL, '41A', 'Essai');`)).toMatch(
      /invalide/,
    );
    expect(await erreur(`SELECT public.compta_plan_enregistrer(NULL, '411', 'Doublon');`)).toMatch(
      /existe déjà/,
    );
    expect(await erreur(`SELECT public.compta_plan_enregistrer(NULL, '4112', ' ');`)).toMatch(
      /Libellé/,
    );
  });

  it("un compte utilisé garde son numéro et ne se supprime pas ; il se désactive", async () => {
    expect(
      await erreur(
        `SELECT public.compta_plan_enregistrer(${idCompte("4711")}, '4712', 'Avance diverse');`,
      ),
    ).toMatch(/numéro ne peut plus changer/);
    expect(await erreur(`DELETE FROM public.plan_comptable WHERE numero = '4711';`)).toMatch(
      /désactivez-le/,
    );
    await db.exec(
      `SELECT public.compta_plan_enregistrer(${idCompte("4711")}, '4711', 'Avances diverses', false);`,
    );
    expect(await compte("4711")).toMatchObject({ libelle: "Avances diverses", actif: false });
    // Un compte jamais utilisé se renumérote et se supprime.
    await db.exec(
      `SELECT public.compta_plan_enregistrer(${idCompte("4111")}, '4112', 'Clients, librairies');`,
    );
    expect(await erreur(`DELETE FROM public.plan_comptable WHERE numero = '4112';`)).toBeNull();
  });

  it("réservé aux droits plan_comptable.creer et plan_comptable.modifier", async () => {
    await db.exec(
      `INSERT INTO public.permissions_refusees VALUES ('plan_comptable.creer'), ('plan_comptable.modifier');`,
    );
    expect(await erreur(`SELECT public.compta_plan_enregistrer(NULL, '4113', 'Essai');`)).toMatch(
      /plan_comptable\.creer/,
    );
    expect(
      await erreur(`SELECT public.compta_plan_enregistrer(${idCompte("411")}, '411', 'Essai');`),
    ).toMatch(/plan_comptable\.modifier/);
    expect(await erreur(`SELECT public.compta_plan_importer_absents();`)).toMatch(
      /plan_comptable\.creer/,
    );
    await db.exec(`DELETE FROM public.permissions_refusees;`);
  });
});

describe("saisie manuelle (0113)", () => {
  it("refuse un compte absent du plan ou désactivé", async () => {
    expect(await erreur(saisie("6998"))).toMatch(/6998 absent du plan comptable/);
    expect(await erreur(saisie("4711"))).toMatch(/désactivé/);
  });

  it("enregistre le compte du plan et son libellé", async () => {
    await db.exec(saisie("601", "Achat de papier"));
    const l = await db.query<{ compte_libelle: string; libelle: string; lie: boolean }>(
      `SELECT l.compte_libelle, l.libelle, l.compte_id = ${idCompte("601")} AS lie
         FROM public.ecriture_lignes l JOIN public.ecritures_comptables e USING (ecriture_id)
        WHERE e.libelle = 'Achat de papier' AND l.numero_compte = '601'`,
    );
    expect(l.rows).toEqual([
      { compte_libelle: "Achats de marchandises", libelle: "Libellé libre", lie: true },
    ]);
  });
});
