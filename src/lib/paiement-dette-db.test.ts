import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { disposableDatabaseUrl } from '@/test/disposable-database';

const url = disposableDatabaseUrl(process.env);
const suite = url ? describe : describe.skip;
let db: Client;
async function setup(amounts = [500000]) {
  const id = randomUUID();
  await db.query('INSERT INTO clients(client_id) VALUES($1)', [id]);
  const invoices: string[] = [];
  for (const amount of amounts) {
    const r = await db.query("INSERT INTO factures(client_id,montant_total,statut) VALUES($1,$2,'impayee') RETURNING facture_id", [id, amount]);
    invoices.push(r.rows[0].facture_id);
  }
  return { id, invoices };
}
function payload(id: string, invoices: string[], amounts: number[], key = randomUUID()) {
  return { client_id: id, montant: amounts.reduce((a,b) => a+b,0), mode_paiement: 'especes', idempotency_key: key,
    allocations: invoices.map((facture_id,i) => ({ facture_id, montant: amounts[i] })) };
}
async function pay(input: ReturnType<typeof payload>, connection = db) {
  const r = await connection.query('SELECT * FROM enregistrer_paiement_multi($1::jsonb)', [JSON.stringify(input)]);
  return r.rows[0].paiement_id as string;
}
async function reject(operation: () => Promise<unknown>) {
  await db.query('SAVEPOINT denied');
  try { await expect(operation()).rejects.toMatchObject({ code: 'P0001' }); }
  finally { await db.query('ROLLBACK TO SAVEPOINT denied'); }
}
async function rollback(operation: () => Promise<void>) {
  await db.query('BEGIN');
  try { await operation(); } finally { await db.query('ROLLBACK'); }
}
async function balance(id: string) {
  const r = await db.query('SELECT solde_client_calcule($1) value', [id]);
  return Number(r.rows[0].value);
}
suite('paiements — base locale explicitement jetable', () => {
  beforeAll(async () => { if (!url) throw new Error('Base jetable obligatoire'); db = new Client({ connectionString: url, ssl: false }); await db.connect(); });
  afterAll(async () => { if (db) await db.end(); });
  it.each([0,-10000])('refuse un solde de %i', async amount => rollback(async () => {
    const c = await setup([amount]);
    await reject(async () => { await pay(payload(c.id,c.invoices,[1])); await db.query('SET CONSTRAINTS ALL IMMEDIATE'); });
  }));
  it('300 000 sur 500 000 donne 200 000', async () => rollback(async () => {
    const c = await setup(); await pay(payload(c.id,c.invoices,[300000])); await db.query('SET CONSTRAINTS ALL IMMEDIATE');
    expect(await balance(c.id)).toBe(200000);
  }));
  it('500 000 sur 500 000 donne zéro', async () => rollback(async () => {
    const c = await setup(); await pay(payload(c.id,c.invoices,[500000])); await db.query('SET CONSTRAINTS ALL IMMEDIATE');
    expect(await balance(c.id)).toBe(0);
  }));
  it('600 000 sur 500 000 est refusé', async () => rollback(async () => {
    const c = await setup(); await reject(async () => { await pay(payload(c.id,c.invoices,[600000])); await db.query('SET CONSTRAINTS ALL IMMEDIATE'); });
  }));
  it('règlement global de 500 000 sur deux factures', async () => rollback(async () => {
    const c = await setup([200000,300000]); await pay(payload(c.id,c.invoices,[200000,300000])); await db.query('SET CONSTRAINTS ALL IMMEDIATE');
    expect(await balance(c.id)).toBe(0);
  }));
  it('retour validé de 300 000 limite le paiement à 200 000', async () => rollback(async () => {
    const c = await setup(); await db.query("INSERT INTO retours(client_id,montant,statut) VALUES($1,300000,'cloture')",[c.id]);
    await db.query('SET CONSTRAINTS ALL IMMEDIATE');
    await reject(() => pay(payload(c.id,c.invoices,[300000])));
    await pay(payload(c.id,c.invoices,[200000])); expect(await balance(c.id)).toBe(0);
  }));
  it('refuse un montant reçu non entièrement affecté', async () => rollback(async () => {
    const c = await setup(); const p = payload(c.id,c.invoices,[300000]); p.montant = 400000;
    await reject(async () => { await pay(p); await db.query('SET CONSTRAINTS ALL IMMEDIATE'); });
  }));
  it('double soumission retrouve un seul paiement et refuse une clé modifiée', async () => rollback(async () => {
    const c = await setup(); const p = payload(c.id,c.invoices,[300000]);
    const first = await pay(p); expect(await pay(p)).toBe(first);
    await reject(() => pay({...p, montant: 100000, allocations: [{facture_id:c.invoices[0],montant:100000}]}));
    await db.query('SET CONSTRAINTS ALL IMMEDIATE');
    expect(await balance(c.id)).toBe(200000);
  }));
  it('la clé ne donne pas accès au paiement d’un autre utilisateur', async () => rollback(async () => {
    const c = await setup(); const p = payload(c.id,c.invoices,[300000]); await pay(p);
    await db.query("SELECT set_config('test.user_id',$1,true)",[randomUUID()]);
    await reject(() => pay(p));
  }));
  it('paiement en attente réserve et rejet libère sans déduire le solde', async () => rollback(async () => {
    const c = await setup(); const pid = await pay(payload(c.id,c.invoices,[300000]));
    await db.query("UPDATE paiements SET statut='en_attente_validation' WHERE paiement_id=$1",[pid]);
    await db.query('SET CONSTRAINTS ALL IMMEDIATE');
    expect(await balance(c.id)).toBe(500000);
    const r = await db.query('SELECT _paiement_dette_etat($1) e',[c.id]); expect(r.rows[0].e.disponible).toBe(200000);
    await reject(() => pay(payload(c.id,c.invoices,[300000])));
    await db.query("UPDATE paiements SET statut='rejete' WHERE paiement_id=$1",[pid]);
    const next = await db.query('SELECT _paiement_dette_etat($1) e',[c.id]); expect(next.rows[0].e.disponible).toBe(500000);
  }));
  it('validation recontrôle après un retour comptabilisé', async () => rollback(async () => {
    const c = await setup(); const pid = await pay(payload(c.id,c.invoices,[300000]));
    await db.query("UPDATE paiements SET statut='en_attente_validation' WHERE paiement_id=$1",[pid]);
    await db.query('SET CONSTRAINTS ALL IMMEDIATE');
    await db.query("INSERT INTO retours(client_id,montant,statut) VALUES($1,250000,'cloture')",[c.id]);
    await reject(() => db.query('SELECT * FROM valider_paiement($1)',[pid]));
  }));
  it('écriture directe excédentaire et suppression d’affectation refusées', async () => rollback(async () => {
    const c = await setup(); const pid = await pay(payload(c.id,c.invoices,[300000])); await db.query('SET CONSTRAINTS ALL IMMEDIATE');
    await reject(() => db.query('UPDATE paiements SET montant=600000 WHERE paiement_id=$1',[pid]));
    await reject(() => db.query('DELETE FROM payment_allocations WHERE paiement_id=$1',[pid]));
  }));
  it.each([false,true])('concurrence : même clé %s', async sameKey => {
    if (!url) throw new Error('Base jetable obligatoire');
    const second = new Client({connectionString:url,ssl:false}); await second.connect();
    const c = await setup(); const p = payload(c.id,c.invoices,[300000]);
    try {
      await db.query('BEGIN'); await second.query('BEGIN'); const first = await pay(p);
      const pending = pay(sameKey ? p : {...p,idempotency_key:randomUUID()},second);
      await db.query('COMMIT'); const other = await pending;
      if (sameKey) { expect(other).toBe(first); await second.query('COMMIT'); }
      else await expect(second.query('COMMIT')).rejects.toMatchObject({code:'P0001'});
      expect(await balance(c.id)).toBe(200000);
    } finally {
      await db.query('ROLLBACK'); await second.query('ROLLBACK'); await second.end();
      await db.query('BEGIN');
      await db.query("UPDATE paiements SET statut='annule' WHERE paiement_id IN (SELECT paiement_id FROM payment_allocations WHERE facture_id=ANY($1::uuid[]))",[c.invoices]);
      await db.query('DELETE FROM payment_allocations WHERE facture_id=ANY($1::uuid[])',[c.invoices]);
      await db.query('DELETE FROM paiements WHERE idempotency_key=$1',[p.idempotency_key]);
      await db.query('DELETE FROM factures WHERE client_id=$1',[c.id]); await db.query('DELETE FROM clients WHERE client_id=$1',[c.id]); await db.query('COMMIT');
    }
  });
});