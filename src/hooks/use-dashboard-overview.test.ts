import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import {
  buildDashboardOverview,
  DashboardDataError,
  fetchAllByKey,
  PAGE,
  requireNumber,
} from "@/hooks/use-dashboard-overview";

type Row = { id: string; v: number };
const rows = (n: number): Row[] =>
  Array.from({ length: n }, (_, i) => ({ id: String(i).padStart(6, "0"), v: i }));

// Simule PostgREST : ORDER BY id, id > after, LIMIT min(PAGE, maxRows).
function fakeTable(data: Row[], maxRows = PAGE) {
  const calls: (string | null)[] = [];
  const page = (after: string | null) => {
    calls.push(after);
    const sorted = [...data].sort((a, b) => a.id.localeCompare(b.id));
    const rest = after === null ? sorted : sorted.filter((r) => r.id > after);
    return Promise.resolve({ data: rest.slice(0, Math.min(PAGE, maxRows)), error: null });
  };
  return { page, calls };
}

describe("fetchAllByKey", () => {
  it("renvoie une liste vide sans erreur quand la table est vide", async () => {
    const t = fakeTable([]);
    expect(await fetchAllByKey<Row, "id">("id", t.page)).toEqual([]);
    expect(t.calls).toEqual([null]);
  });

  it("lit plus de 1 000 lignes avec une dernière page partielle, sans doublon ni omission", async () => {
    const t = fakeTable(rows(2500));
    const all = await fetchAllByKey<Row, "id">("id", t.page);
    expect(all).toHaveLength(2500);
    expect(new Set(all.map((r) => r.id)).size).toBe(2500);
    expect(t.calls).toEqual([null, "000999", "001999", "002499"]);
  });

  it("lit exactement 2 pages complètes puis s'arrête sur la page vide", async () => {
    const t = fakeTable(rows(2 * PAGE));
    expect(await fetchAllByKey<Row, "id">("id", t.page)).toHaveLength(2 * PAGE);
    expect(t.calls).toHaveLength(3);
  });

  it("ne tronque pas quand le serveur plafonne max-rows sous la taille de page", async () => {
    const t = fakeTable(rows(1200), 500);
    expect(await fetchAllByKey<Row, "id">("id", t.page)).toHaveLength(1200);
  });

  it("ni doublon ni omission quand une ligne est supprimée ou ajoutée pendant la lecture", async () => {
    const data = rows(2500);
    let n = 0;
    const page = (after: string | null) => {
      // Après la 1re page : une ligne déjà lue est supprimée, une nouvelle est insérée avant la clé.
      if (n++ === 1) {
        data.splice(10, 1);
        data.push({ id: "000500a", v: -1 });
      }
      const rest = data.filter((r) => after === null || r.id > after).sort((a, b) => a.id.localeCompare(b.id));
      return Promise.resolve({ data: rest.slice(0, PAGE), error: null });
    };
    const all = await fetchAllByKey<Row, "id">("id", page);
    const ids = all.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Toutes les lignes présentes au départ et non supprimées sont lues.
    for (let i = 0; i < 2500; i++) expect(ids).toContain(String(i).padStart(6, "0"));
  });

  it("remonte l'erreur d'une page au lieu de renvoyer une liste partielle", async () => {
    const err = new Error("RLS");
    let n = 0;
    const page = () =>
      Promise.resolve(n++ === 0 ? { data: rows(PAGE), error: null } : { data: null, error: err });
    await expect(fetchAllByKey<Row, "id">("id", page)).rejects.toBe(err);
  });

  it("échoue au lieu de boucler si la clé de tri est absente", async () => {
    const page = () => Promise.resolve({ data: [{ id: null as unknown as string, v: 0 }], error: null });
    await expect(fetchAllByKey<Row, "id">("id", page)).rejects.toBeInstanceOf(DashboardDataError);
  });
});

describe("requireNumber", () => {
  it("accepte un zéro légitime et les numeric Postgres en texte", () => {
    expect(requireNumber(0, "x")).toBe(0);
    expect(requireNumber("0", "x")).toBe(0);
    expect(requireNumber("1234.50", "x")).toBe(1234.5);
    expect(requireNumber(-150, "x")).toBe(-150);
  });
  it("refuse une valeur absente", () => {
    for (const v of [null, undefined, ""]) expect(() => requireNumber(v, "caTotal")).toThrow(/absent/);
  });
  it("refuse une valeur invalide au lieu de l'afficher comme 0", () => {
    for (const v of ["abc", NaN, Infinity, {}, true]) expect(() => requireNumber(v, "caTotal")).toThrow(/invalide/);
  });
});

const OV = {
  nbCommandes: 3,
  caTotal: "150000.00",
  montantFacture: 200000,
  montantEncaisse: "150000.00",
  resteAEncaisser: 50000,
  tauxEncaissement: "75.00",
  parStatut: [{ statut: "validee", count: 3 }],
  caMensuel: [
    { y: 2026, m: 10, ca: "150000", nb: 2 },
    { y: 2026, m: 3, ca: "999", nb: 1 }, // hors des 6 derniers mois affichés
  ],
  recettes: "150000",
  depenses: 0,
  solde: "150000",
  nbRetards: 0,
  montantRetard: 0,
  stockBas: [],
  nbStockBas: 0,
};
const CS = { total: 10, actifs: "8", solde_total: "50000" };
const NOW = new Date(2026, 9, 29);

describe("buildDashboardOverview", () => {
  it("convertit une réponse complète, zéros légitimes compris", () => {
    const d = buildDashboardOverview({ clientsStats: CS, overview: OV, tournees: [], produits: [], now: NOW });
    expect(d.caTotal).toBe(150000);
    expect(d.tauxEncaissement).toBe(75);
    expect(d.depenses).toBe(0);
    expect(d.clientsActifs).toBe(8);
    expect(d.caMensuel.map((b) => b.key)).toEqual(["2026-5", "2026-6", "2026-7", "2026-8", "2026-9", "2026-10"]);
    expect(d.caMensuel.at(-1)).toMatchObject({ ca: 150000, nb: 2 });
  });

  it("passe en erreur si la RPC ne renvoie rien", () => {
    expect(() =>
      buildDashboardOverview({ clientsStats: CS, overview: null, tournees: [], produits: [], now: NOW }),
    ).toThrow(DashboardDataError);
  });

  it("passe en erreur si un champ financier obligatoire manque", () => {
    const { resteAEncaisser: _omis, ...incomplet } = OV;
    expect(() =>
      buildDashboardOverview({ clientsStats: CS, overview: incomplet, tournees: [], produits: [], now: NOW }),
    ).toThrow(/resteAEncaisser/);
  });

  it("passe en erreur si un montant est illisible", () => {
    expect(() =>
      buildDashboardOverview({ clientsStats: CS, overview: { ...OV, caTotal: "N/A" }, tournees: [], produits: [], now: NOW }),
    ).toThrow(/caTotal/);
    expect(() =>
      buildDashboardOverview({ clientsStats: { ...CS, solde_total: null }, overview: OV, tournees: [], produits: [], now: NOW }),
    ).toThrow(/solde_total/);
  });

  it("additionne les frais de tournées, une tournée sans coût comptant 0", () => {
    const tournees = [
      { tournee_id: "a", cout_total: 1000 },
      { tournee_id: "b", cout_total: null },
      { tournee_id: "c", cout_total: 2500.5 },
    ];
    const d = buildDashboardOverview({ clientsStats: CS, overview: OV, tournees, produits: [], now: NOW });
    expect(d.fraisTournees).toBe(3500.5);
  });

  it("alertes stock : compteur et liste suivent la même règle, seuil 0 = pas d'alerte", () => {
    const produits = [
      { produit_id: "1", titre: "Sous le seuil", stock: 2, seuil_alerte: 5 },
      { produit_id: "2", titre: "Au seuil", stock: 5, seuil_alerte: 5 },
      { produit_id: "3", titre: "Au-dessus", stock: 6, seuil_alerte: 5 },
      { produit_id: "4", titre: "Seuil 0", stock: 0, seuil_alerte: 0 },
      { produit_id: "5", titre: "Seuil absent", stock: 0, seuil_alerte: null },
      { produit_id: "6", titre: "Négatif", stock: -1, seuil_alerte: 1 },
    ];
    const d = buildDashboardOverview({
      clientsStats: CS,
      overview: { ...OV, nbStockBas: 99 }, // valeur RPC ignorée : une seule source
      tournees: [],
      produits,
      now: NOW,
    });
    expect(d.stockBas.map((p) => p.titre)).toEqual(["Négatif", "Sous le seuil", "Au seuil"]);
    expect(d.nbStockBas).toBe(d.stockBas.length);
  });

  it("compte toutes les alertes au-delà de 1 000 produits", () => {
    const produits = Array.from({ length: 1500 }, (_, i) => ({
      produit_id: String(i),
      titre: `P${i}`,
      stock: 0,
      seuil_alerte: 1,
    }));
    const d = buildDashboardOverview({ clientsStats: CS, overview: OV, tournees: [], produits, now: NOW });
    expect(d.nbStockBas).toBe(1500);
  });
});
