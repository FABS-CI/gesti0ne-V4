import { Client } from "pg";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { disposableDatabaseUrl } from "@/test/disposable-database";

const url = disposableDatabaseUrl(process.env);
const suite = url ? describe : describe.skip;
let db: Client;

async function client(solde: number) {
  const id = randomUUID();
  await db.query("INSERT INTO clients(client_id) VALUES($1)", [id]);
  await db.query("INSERT INTO factures(client_id,montant_total,statut) VALUES($1,$2,'validee')", [id, solde]);
  return id;
}
async function retour(id: string, montant: number, statut = "demande_creee", connection = db) {
  const result = await connection.query("INSERT INTO retours(client_id,montant,statut) VALUES($1,$2,$3) RETURNING retour_id", [id, montant, statut]);
  return result.rows[0].retour_id as string;
}
async function refuses(operation: () => Promise<unknown>) {
  await db.query("SAVEPOINT denied");
  try { await expect(operation()).rejects.toMatchObject({ code: "P0001" }); }
  finally { await db.query("ROLLBACK TO SAVEPOINT denied"); }
}

suite("retour encours — base locale jetable", () => {
  beforeAll(async () => {
    if (!url) throw new Error("Base jetable obligatoire");
    db = new Client({ connectionString: url, ssl: false }); await db.connect();
  });
  afterAll(async () => { if (db) await db.end(); });

  it.each([0, -10_000])("refuse un solde de %i côté base", async (solde) => {
    await db.query("BEGIN");
    try {
      const id = await client(solde);
      await refuses(async () => { await retour(id, 1); await db.query("SET CONSTRAINTS ALL IMMEDIATE"); });
    } finally { await db.query("ROLLBACK"); }
  });
  it("100 000 : accepte le plafond et refuse le dépassement", async () => {
    await db.query("BEGIN");
    try {
      const id = await client(100_000); await retour(id, 100_000);
      await db.query("SET CONSTRAINTS ALL IMMEDIATE");
      await refuses(() => retour(id, 1));
      const r = await db.query("SELECT solde_client_calcule($1) solde", [id]); expect(Number(r.rows[0].solde)).toBe(100_000);
    } finally { await db.query("ROLLBACK"); }
  });
  it("500 000 : réserve 300 000, refuse 600 000 et libère après refus", async () => {
    await db.query("BEGIN");
    try {
      const id = await client(500_000);
      await refuses(async () => { await retour(id, 600_000); await db.query("SET CONSTRAINTS ALL IMMEDIATE"); });
      const rid = await retour(id, 300_000); await db.query("SET CONSTRAINTS ALL IMMEDIATE");
      let r = await db.query("SELECT _retour_encours_etat($1) etat", [id]); expect(r.rows[0].etat).toEqual({ solde: 500_000, reserve: 300_000, disponible: 200_000 });
      await db.query("UPDATE retours SET statut='refus_compta' WHERE retour_id=$1", [rid]);
      r = await db.query("SELECT _retour_encours_etat($1) etat", [id]); expect(r.rows[0].etat.disponible).toBe(500_000);
    } finally { await db.query("ROLLBACK"); }
  });
  it("validation : ne réserve ni ne déduit deux fois", async () => {
    await db.query("BEGIN");
    try {
      const id = await client(500_000); const rid = await retour(id, 300_000);
      await db.query("UPDATE retours SET statut='cloture' WHERE retour_id=$1", [rid]); await db.query("SET CONSTRAINTS ALL IMMEDIATE");
      const r = await db.query("SELECT _retour_encours_etat($1) etat", [id]); expect(r.rows[0].etat).toEqual({ solde: 200_000, reserve: 0, disponible: 200_000 });
    } finally { await db.query("ROLLBACK"); }
  });
  it("lignes directes : empêche un montant dissimulé", async () => {
    await db.query("BEGIN");
    try {
      const id = await client(500_000); const rid = await retour(id, 0);
      await refuses(async () => { await db.query("INSERT INTO retour_lignes(retour_id,total_ligne) VALUES($1,600000)", [rid]); await db.query("SET CONSTRAINTS ALL IMMEDIATE"); });
    } finally { await db.query("ROLLBACK"); }
  });
  it("remise globale de 25 % : réserve 300 000 sur 400 000 de lignes", async () => {
    await db.query("BEGIN");
    try {
      const id = await client(500_000); const rid = await retour(id, 300_000);
      await db.query("UPDATE retours SET remise_globale_pct=25 WHERE retour_id=$1", [rid]);
      await db.query("INSERT INTO retour_lignes(retour_id,total_ligne) VALUES($1,400000)", [rid]);
      await db.query("SET CONSTRAINTS ALL IMMEDIATE");
      const r = await db.query("SELECT _retour_encours_etat($1) etat", [id]);
      expect(r.rows[0].etat).toEqual({ solde: 500_000, reserve: 300_000, disponible: 200_000 });
    } finally { await db.query("ROLLBACK"); }
  });
  it("annulation : libère la réservation sans changer la dette", async () => {
    await db.query("BEGIN");
    try {
      const id = await client(500_000); const rid = await retour(id, 300_000);
      await db.query("UPDATE retours SET statut='annule' WHERE retour_id=$1", [rid]);
      await db.query("SET CONSTRAINTS ALL IMMEDIATE");
      const r = await db.query("SELECT _retour_encours_etat($1) etat", [id]);
      expect(r.rows[0].etat).toEqual({ solde: 500_000, reserve: 0, disponible: 500_000 });
    } finally { await db.query("ROLLBACK"); }
  });
  it("paiement concurrent : recontrôle le solde au moment de valider", async () => {
    if (!url) throw new Error("Base jetable obligatoire");
    const second = new Client({ connectionString: url, ssl: false }); await second.connect();
    const id = await client(500_000); const rid = await retour(id, 300_000);
    let pid: string | undefined;
    try {
      await db.query("BEGIN"); await second.query("BEGIN");
      const payment = await db.query("INSERT INTO paiements(statut) VALUES('valide') RETURNING paiement_id"); pid = payment.rows[0].paiement_id;
      await db.query("INSERT INTO payment_allocations(facture_id,paiement_id,montant) SELECT facture_id,$2,250000 FROM factures WHERE client_id=$1", [id, pid]);
      const pending = second.query("UPDATE retours SET statut='cloture' WHERE retour_id=$1", [rid]);
      await db.query("COMMIT"); await pending;
      await expect(second.query("COMMIT")).rejects.toMatchObject({ code: "P0001" });
      const r = await db.query("SELECT statut FROM retours WHERE retour_id=$1", [rid]); expect(r.rows[0].statut).toBe("demande_creee");
    } finally {
      await db.query("ROLLBACK"); await second.query("ROLLBACK"); await second.end();
      await db.query("DELETE FROM retours WHERE client_id=$1", [id]);
      await db.query("DELETE FROM payment_allocations WHERE paiement_id=$1", [pid]);
      await db.query("DELETE FROM paiements WHERE paiement_id=$1", [pid]);
      await db.query("DELETE FROM factures WHERE client_id=$1", [id]); await db.query("DELETE FROM clients WHERE client_id=$1", [id]);
    }
  });
  it("deux demandes simultanées de 300 000 : la seconde attend puis est refusée", async () => {
    if (!url) throw new Error("Base jetable obligatoire");
    const second = new Client({ connectionString: url, ssl: false }); await second.connect();
    const id = await client(500_000); // Only in the disposable DB; remove in finally.
    try {
      await db.query("BEGIN"); await second.query("BEGIN"); await retour(id, 300_000);
      const pending = retour(id, 300_000, "demande_creee", second);
      await db.query("COMMIT"); await pending;
      await expect(second.query("COMMIT")).rejects.toMatchObject({ code: "P0001" });
      const r = await db.query("SELECT count(*) n FROM retours WHERE client_id=$1", [id]); expect(Number(r.rows[0].n)).toBe(1);
    } finally {
      await db.query("ROLLBACK"); await second.query("ROLLBACK"); await second.end();
      await db.query("DELETE FROM retours WHERE client_id=$1", [id]); await db.query("DELETE FROM factures WHERE client_id=$1", [id]); await db.query("DELETE FROM clients WHERE client_id=$1", [id]);
    }
  });
});