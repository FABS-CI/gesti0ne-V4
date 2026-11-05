/**
 * Tests Retours sur une base locale jetable uniquement.
 * GESTI0NE_RUN_DB_TESTS=disposable et GESTI0NE_TEST_DATABASE_URL sont obligatoires.
 * Les variables PG* héritées ne sont jamais utilisées ; aucune fixture n'est commitée.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { disposableDatabaseUrl } from "@/test/disposable-database";

const testUrl = disposableDatabaseUrl(process.env);
const hasDb = testUrl !== null;
const d = hasDb ? describe : describe.skip;

let db: Client;
let exerciceId: string;
let depotId: string;
const createdRetourIds: string[] = [];
const createdFactureIds: string[] = [];
const createdCommandeIds: string[] = [];
const createdClientIds: string[] = [];
const createdProduitIds: string[] = [];

async function q<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
  const res = await db.query(sql, params);
  return res.rows as T[];
}

async function seedClient(): Promise<string> {
  const [row] = await q<{ client_id: string }>(
    "INSERT INTO public.clients(nom) VALUES('TEST-INT-'||gen_random_uuid()::text) RETURNING client_id",
  );
  createdClientIds.push(row.client_id);
  return row.client_id;
}

async function seedProduit(prix = 1000): Promise<string> {
  const [row] = await q<{ produit_id: string }>(
    "INSERT INTO public.produits(titre, reference, prix_vente) VALUES('P-'||gen_random_uuid()::text, 'REF-'||substr(gen_random_uuid()::text,1,8), $1) RETURNING produit_id",
    [prix],
  );
  createdProduitIds.push(row.produit_id);
  return row.produit_id;
}

async function seedCommandeAvecLigne(
  clientId: string,
  produitId: string,
  qte: number,
  prix: number,
): Promise<string> {
  const total = qte * prix;
  const [c] = await q<{ commande_id: string }>(
    "INSERT INTO public.commandes(reference, client_id, statut, exercice_id, montant_total) VALUES('CMD-TEST-'||substr(gen_random_uuid()::text,1,8), $1,'validee',$2,$3) RETURNING commande_id",
    [clientId, exerciceId, total],
  );
  createdCommandeIds.push(c.commande_id);
  await q(
    "INSERT INTO public.commande_lignes(commande_id, produit_id, designation, quantite, prix_unitaire, total_ligne, total_ht_ligne) VALUES($1,$2,'Prod test',$3,$4,$5,$5)",
    [c.commande_id, produitId, qte, prix, total],
  );
  return c.commande_id;
}

async function seedFacture(clientId: string, commandeId: string, montant: number): Promise<string> {
  const [f] = await q<{ facture_id: string }>(
    "INSERT INTO public.factures(client_id, commande_id, montant_total, exercice_id) VALUES($1,$2,$3,$4) RETURNING facture_id",
    [clientId, commandeId, montant, exerciceId],
  );
  createdFactureIds.push(f.facture_id);
  return f.facture_id;
}

async function creerRetourPayload(payload: Record<string, unknown>) {
  const res = await db.query("SELECT * FROM public.creer_retour($1::jsonb)", [
    JSON.stringify(payload),
  ]);
  return res.rows[0] as { retour_id: string; montant: string; statut: string };
}

async function solde(clientId: string): Promise<number> {
  // Recalcule le solde côté RPC puis lit la valeur matérialisée sur clients.
  await db.query("SELECT public.recalculer_solde_client($1)", [clientId]);
  const [row] = await q<{ solde: string | null }>(
    "SELECT solde FROM public.clients WHERE client_id=$1",
    [clientId],
  );
  return Number(row?.solde ?? 0);
}

d("Retours — intégration RPC", () => {
  beforeAll(async () => {
    if (!testUrl) throw new Error("Base jetable absente");
    db = new Client({ connectionString: testUrl, ssl: false });
    await db.connect();
    await db.query("BEGIN");
    // Charge un super_admin dans les claims JWT pour toute la session : les RPC
    // (creer_retour, annuler_retour, …) exigent une auth.uid() valide via
    // assert_permission — sans quoi elles échouent avec SQLSTATE 28000 avant
    // les checks métier P0001…P0005 testés ici.
    // Sélectionne un super_admin qui possède RÉELLEMENT la permission via
    // RBAC v2 (certains super_admin historiques n'ont jamais été rattachés
    // aux rôles rbac2_*).
    const admins = await q<{ user_id: string }>(
      "SELECT ur.user_id FROM public.user_roles ur WHERE ur.role='super_admin' AND public.has_permission_v2(ur.user_id, 'retours.creer') LIMIT 1",
    );
    if (admins.length) {
      await db.query(
        "SELECT set_config('request.jwt.claims', json_build_object('sub', $1::text, 'role','authenticated')::text, false)",
        [admins[0].user_id],
      );
    }
    const [ex] = await q<{ id: string }>("SELECT public.exercice_actif_id() AS id");
    exerciceId = ex.id;
    const [dep] = await q<{ depot_id: string }>(
      "SELECT depot_id FROM public.depots WHERE actif=true LIMIT 1",
    );
    depotId = dep.depot_id;
  });

  afterAll(async () => {
    if (!db) return;
    await db.query("ROLLBACK");
    await db.end();
  });

  // NOTE : les gardes SQLSTATE P0001…P0005 ont été retirées de `creer_retour`
  // lors du refactor SYSCOHADA + RBAC v2. Les validations sont désormais
  // portées côté formulaire (`src/routes/retours/*`) et par des permissions
  // RBAC granulaires. Les cas sont conservés en `skip` comme documentation
  // historique : si l'on rétablit un jour ces gardes, retirer `.skip`.
  it.skip("refuse un retour sans dépôt (P0001)", async () => {
    const clientId = await seedClient();
    await expect(
      creerRetourPayload({
        client_id: clientId,
        lignes: [{ designation: "Libre", quantite: 1 }],
      }),
    ).rejects.toMatchObject({ code: "P0001" });
  });

  it.skip("refuse une facture d'un autre client (P0002)", async () => {
    const c1 = await seedClient();
    const c2 = await seedClient();
    const prod = await seedProduit();
    const cmd = await seedCommandeAvecLigne(c1, prod, 5, 1000);
    const fac = await seedFacture(c1, cmd, 5000);
    await expect(
      creerRetourPayload({
        client_id: c2,
        depot_id: depotId,
        facture_id: fac,
        lignes: [{ produit_id: prod, designation: "P", quantite: 1 }],
      }),
    ).rejects.toMatchObject({ code: "P0002" });
  });

  it.skip("refuse une livraison d'un autre client (P0003)", async () => {
    const c1 = await seedClient();
    const c2 = await seedClient();
    const [liv] = await q<{ livraison_id: string }>(
      "INSERT INTO public.livraisons(client_id) VALUES($1) RETURNING livraison_id",
      [c1],
    );
    await expect(
      creerRetourPayload({
        client_id: c2,
        depot_id: depotId,
        livraison_id: liv.livraison_id,
        lignes: [{ designation: "Libre", quantite: 1 }],
      }),
    ).rejects.toMatchObject({ code: "P0003" });
    try {
      await db.query("DELETE FROM public.livraisons WHERE livraison_id=$1", [liv.livraison_id]);
    } catch {
      /* cleanup best-effort */
    }
  });

  it.skip("refuse un produit absent de la facture (P0004)", async () => {
    const c = await seedClient();
    const prodA = await seedProduit();
    const prodB = await seedProduit();
    const cmd = await seedCommandeAvecLigne(c, prodA, 5, 1000);
    const fac = await seedFacture(c, cmd, 5000);
    await expect(
      creerRetourPayload({
        client_id: c,
        depot_id: depotId,
        facture_id: fac,
        lignes: [{ produit_id: prodB, designation: "Autre", quantite: 1 }],
      }),
    ).rejects.toMatchObject({ code: "P0004" });
  });

  it.skip("refuse une quantité supérieure au disponible (P0005)", async () => {
    const c = await seedClient();
    const prod = await seedProduit();
    const cmd = await seedCommandeAvecLigne(c, prod, 5, 1000);
    const fac = await seedFacture(c, cmd, 5000);
    await expect(
      creerRetourPayload({
        client_id: c,
        depot_id: depotId,
        facture_id: fac,
        lignes: [{ produit_id: prod, designation: "Prod test", quantite: 999 }],
      }),
    ).rejects.toMatchObject({ code: "P0005" });
  });

  // ─── Workflow retours v2 : demande → réception → validation compta ───────
  it("déroule le workflow retour et impacte stock + solde client", async () => {
    // Vérifie que le super_admin chargé en beforeAll possède réellement les
    // permissions RBAC v2 nécessaires ; sans quoi on skippe proprement.
    const [perm] = await q<{ ok: boolean }>(
      `SELECT public.has_permission_v2((NULLIF(current_setting('request.jwt.claims', true),'')::jsonb->>'sub')::uuid, 'retours.creer')
          AND public.has_permission_v2((NULLIF(current_setting('request.jwt.claims', true),'')::jsonb->>'sub')::uuid, 'retours.receptionner')
          AND public.has_permission_v2((NULLIF(current_setting('request.jwt.claims', true),'')::jsonb->>'sub')::uuid, 'retours.valider_compta') AS ok`,
    );
    if (!perm?.ok) {
      console.warn("[retours-integration] super_admin sans permissions v2 — test skippé");
      return;
    }

    const c = await seedClient();
    const prod = await seedProduit(2000);
    const cmd = await seedCommandeAvecLigne(c, prod, 10, 2000);
    const fac = await seedFacture(c, cmd, 20000);

    // 1. Demande créée
    const [{ retour_id: retourId }] = await q<{ retour_id: string }>(
      "SELECT public.retour_creer_demande($1::jsonb) AS retour_id",
      [
        JSON.stringify({
          client_id: c,
          depot_id: depotId,
          facture_id: fac,
          commande_id: cmd,
          type_retour: "physique",
          lignes: [
            { produit_id: prod, designation: "Prod test", quantite: 3, prix_unitaire: 2000 },
          ],
        }),
      ],
    );
    createdRetourIds.push(retourId);

    const [apresDemande] = await q<{ statut: string; version_no: number }>(
      "SELECT statut, version_no FROM public.retours WHERE retour_id=$1",
      [retourId],
    );
    // le trigger d'approbation bascule immédiatement en attente de réception
    expect(["demande_creee", "attente_reception"]).toContain(apresDemande.statut);

    // 2. Réception magasin → entrée de stock
    const [ligne] = await q<{ ligne_id: string }>(
      "SELECT ligne_id FROM public.retour_lignes WHERE retour_id=$1",
      [retourId],
    );
    await db.query("SELECT public.retour_receptionner($1,$2,$3::jsonb)", [
      retourId,
      apresDemande.version_no,
      JSON.stringify([
        {
          ligne_id: ligne.ligne_id,
          produit_id: prod,
          quantite_recue: 3,
          etat_reception: "conforme",
        },
      ]),
    ]);

    const [apresReception] = await q<{ statut: string; version_no: number }>(
      "SELECT statut, version_no FROM public.retours WHERE retour_id=$1",
      [retourId],
    );
    expect(apresReception.statut).toBe("attente_validation_compta");

    const [{ entrees }] = await q<{ entrees: string }>(
      "SELECT COALESCE(SUM(quantite),0) AS entrees FROM public.stock_mouvements WHERE produit_id=$1 AND depot_id=$2 AND type='entree' AND document_id=$3",
      [prod, depotId, retourId],
    );
    expect(Number(entrees)).toBe(3);

    // 3. Validation comptable → diminution du solde client (3 × 2000)
    await db.query("SELECT public.retour_valider_compta($1,$2,$3,$4::jsonb,$5)", [
      retourId,
      apresReception.version_no,
      "diminuer_solde",
      JSON.stringify({ valeur_retour: 6000 }),
      "Test intégration",
    ]);

    const [apres] = await q<{ statut: string }>(
      "SELECT statut FROM public.retours WHERE retour_id=$1",
      [retourId],
    );
    expect(apres.statut).toBe("cloture");

    const [apresSolde] = await q<{ solde: string | null }>(
      "SELECT solde FROM public.clients WHERE client_id=$1",
      [c],
    );
    // Le solde est recalculé à partir des impayés : facture 20 000 − avoir 6 000.
    expect(Number(apresSolde.solde ?? 0)).toBe(14000);
  });
});


// Harnais createLivraison — vérifie que la contrainte FK protège les inserts
// avec des références inexistantes (transporteur/gare/livreur).
d("createLivraison — intégration FK", () => {
  let db2: Client;
  beforeAll(async () => {
    if (!testUrl) throw new Error("Base jetable absente");
    db2 = new Client({ connectionString: testUrl, ssl: false });
    await db2.connect();
    await db2.query("BEGIN");
  });
  afterAll(async () => {
    if (db2) {
      await db2.query("ROLLBACK");
      await db2.end();
    }
  });

  const missing = "00000000-0000-4000-8000-000000000000";
  const cases: Array<[string, string]> = [
    ["transporteur_id", "refuse un transporteur_id inexistant"],
    ["gare_depart_id", "refuse une gare_depart_id inexistante"],
    ["gare_arrivee_id", "refuse une gare_arrivee_id inexistante"],
    ["livreur_id", "refuse un livreur_id inexistant"],
  ];
  cases.forEach(([col, name]) => {
    it(name, async () => {
      await db2.query("SAVEPOINT fk_attempt");
      try {
        await expect(
          db2.query(
            `INSERT INTO public.livraisons(${col}, date_livraison) VALUES($1, current_date)`,
            [missing],
          ),
        ).rejects.toMatchObject({ code: "23503" });
      } finally {
        await db2.query("ROLLBACK TO SAVEPOINT fk_attempt");
      }
    });
  });
});
