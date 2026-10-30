// Smoke / charge basique — FabsCI Gest
// Usage:
//   TEST_EMAIL=xxx TEST_PASSWORD=yyy TEST_CLIENT_ID=<uuid> \
//   BASE_URL=https://fabsci-gest.lovable.app \
//   SUPABASE_URL=https://<ref>.supabase.co \
//   SUPABASE_ANON_KEY=sb_publishable_... \
//   k6 run scripts/load/k6-smoke.js
//
// Le compte TEST_EMAIL doit être dédié aux tests de charge (jamais utilisé en prod).
// TEST_CLIENT_ID doit référencer un client "LOADTEST" créé au préalable.
// Toutes les commandes créées portent la référence `LOAD-<vu>-<iter>` et sont
// supprimées automatiquement dans `teardown()` via le filtre `reference=like.LOAD-*`.
//
// Docs: https://k6.io/docs/

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Trend, Rate } from "k6/metrics";

const SCENARIOS = {
  smoke: { executor: "constant-vus", vus: 5, duration: "30s" },
  ramp:  { executor: "ramping-vus", startTime: "35s", startVUs: 0,
           stages: [
             { duration: "30s", target: 20 },
             { duration: "1m",  target: 20 },
             { duration: "20s", target: 0  },
           ] },
};

// Scénarios à lancer : SCENARIOS=smoke (CI des pull requests), défaut smoke,ramp.
// (k6 n'a pas d'option --exclude-scenarios.)
const CHOISIS = (__ENV.SCENARIOS || "smoke,ramp").split(",").map((s) => s.trim()).filter(Boolean);
for (const nom of CHOISIS) {
  if (!SCENARIOS[nom]) throw new Error(`Scénario inconnu : ${nom} (smoke, ramp)`);
}

export const options = {
  scenarios: Object.fromEntries(CHOISIS.map((nom) => [nom, SCENARIOS[nom]])),
  thresholds: {
    http_req_failed:   ["rate<0.02"],
    http_req_duration: ["p(95)<1500"],
    login_duration:    ["p(95)<2000"],
  },
};

const loginTrend = new Trend("login_duration", true);
const errRate    = new Rate("errors");

const SUPABASE_URL = __ENV.SUPABASE_URL;
const ANON_KEY     = __ENV.SUPABASE_ANON_KEY;
const BASE_URL     = __ENV.BASE_URL || "http://localhost:8080";
const EMAIL        = __ENV.TEST_EMAIL;
const PASSWORD     = __ENV.TEST_PASSWORD;
const CLIENT_ID    = __ENV.TEST_CLIENT_ID;
const REF_PREFIX   = "LOAD-";

function login() {
  const r = http.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { "Content-Type": "application/json", apikey: ANON_KEY } },
  );
  loginTrend.add(r.timings.duration);
  const ok = check(r, { "login 200": (x) => x.status === 200 });
  errRate.add(!ok);
  return ok ? r.json("access_token") : null;
}

function authHeaders(token) {
  return { apikey: ANON_KEY, Authorization: `Bearer ${token}`,
           "Content-Type": "application/json", Prefer: "return=representation" };
}

export function setup() {
  if (!EMAIL || !PASSWORD || !SUPABASE_URL || !ANON_KEY) {
    throw new Error("TEST_EMAIL / TEST_PASSWORD / SUPABASE_URL / SUPABASE_ANON_KEY requis");
  }
  if (!CLIENT_ID) {
    throw new Error("TEST_CLIENT_ID requis — créer un client dédié 'LOADTEST' et passer son UUID");
  }
  const token = login();
  if (!token) throw new Error("Login setup échoué");
  return { token };
}

export default function () {
  const token = login();
  if (!token) return;

  group("read produits", () => {
    const r = http.get(`${SUPABASE_URL}/rest/v1/produits?select=produit_id,designation,prix_vente&limit=50`,
      { headers: authHeaders(token) });
    check(r, { "produits 200": (x) => x.status === 200 });
  });

  group("read clients", () => {
    const r = http.get(`${SUPABASE_URL}/rest/v1/clients?select=client_id,nom&limit=50`,
      { headers: authHeaders(token) });
    check(r, { "clients 200": (x) => x.status === 200 });
  });

  group("read commandes récentes", () => {
    const r = http.get(`${SUPABASE_URL}/rest/v1/commandes?select=commande_id,reference,statut,montant_total&order=created_at.desc&limit=20`,
      { headers: authHeaders(token) });
    check(r, { "commandes 200": (x) => x.status === 200 });
  });

  group("read stocks_depots", () => {
    const r = http.get(`${SUPABASE_URL}/rest/v1/stocks_depots?select=id,produit_id,depot_id,quantite&limit=50`,
      { headers: authHeaders(token) });
    check(r, { "stocks 200": (x) => x.status === 200 });
  });

  group("read stock_mouvements", () => {
    const r = http.get(`${SUPABASE_URL}/rest/v1/stock_mouvements?select=mouvement_id,type,quantite,created_at&order=created_at.desc&limit=20`,
      { headers: authHeaders(token) });
    check(r, { "mouvements 200": (x) => x.status === 200 });
  });

  group("create commande", () => {
    const ref = `${REF_PREFIX}${__VU}-${__ITER}-${Date.now()}`;
    const r = http.post(
      `${SUPABASE_URL}/rest/v1/commandes`,
      JSON.stringify({
        client_id: CLIENT_ID,
        reference: ref,
        statut: "brouillon",
        montant_total: 0,
      }),
      { headers: authHeaders(token) },
    );
    const ok = check(r, { "commande créée (201)": (x) => x.status === 201 });
    errRate.add(!ok);
  });

  group("create paiement", () => {
    const ref = `${REF_PREFIX}PMT-${__VU}-${__ITER}-${Date.now()}`;
    const r = http.post(
      `${SUPABASE_URL}/rest/v1/paiements`,
      JSON.stringify({
        reference: ref,
        client_nom: "LOADTEST",
        date_paiement: new Date().toISOString().slice(0, 10),
        montant: 1000,
        mode_paiement: "especes",
        statut: "en_attente",
      }),
      { headers: authHeaders(token) },
    );
    const ok = check(r, { "paiement créé (201)": (x) => x.status === 201 });
    errRate.add(!ok);
  });

  group("create retour", () => {
    const ref = `${REF_PREFIX}RET-${__VU}-${__ITER}-${Date.now()}`;
    const r = http.post(
      `${SUPABASE_URL}/rest/v1/retours`,
      JSON.stringify({
        reference: ref,
        client_id: CLIENT_ID,
        client_nom: "LOADTEST",
        produit_nom: "Article test",
        quantite: 1,
        total_quantite: 1,
        nb_produits: 1,
        montant: 500,
        date_retour: new Date().toISOString().slice(0, 10),
        type_retour: "client",
        statut: "en_attente",
      }),
      { headers: authHeaders(token) },
    );
    const ok = check(r, { "retour créé (201)": (x) => x.status === 201 });
    errRate.add(!ok);
  });

  group("home page (SSR)", () => {
    const r = http.get(BASE_URL);
    check(r, { "home 200": (x) => x.status === 200 });
  });

  sleep(1);
}

// Nettoyage : supprime toutes les commandes créées par le test (préfixe LOAD-).
// Nécessite que RLS/policy autorise l'utilisateur de test à DELETE sur `commandes`.
export function teardown(data) {
  const token = (data && data.token) || login();
  if (!token) return;
  const tables = ["commandes", "paiements", "retours"];
  for (const t of tables) {
    const url = `${SUPABASE_URL}/rest/v1/${t}?reference=like.${REF_PREFIX}%25`;
    const r = http.del(url, null, { headers: authHeaders(token) });
    check(r, { [`cleanup ${t} 2xx`]: (x) => x.status >= 200 && x.status < 300 });
    console.log(`teardown: DELETE ${t} -> ${r.status}`);
  }
}
