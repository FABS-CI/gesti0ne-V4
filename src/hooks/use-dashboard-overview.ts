import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MOIS, type Periode } from "@/lib/dashboard-helpers";

type DashboardFullRPC = {
  nbCommandes: number;
  caTotal: number | string;
  montantFacture: number | string;
  montantEncaisse: number | string;
  resteAEncaisser: number | string;
  tauxEncaissement: number | string;
  parStatut: { statut: string; count: number }[];
  caMensuel: { y: number; m: number; ca: number | string; nb: number }[];
  recettes: number | string;
  depenses: number | string;
  solde: number | string;
  nbRetards: number;
  montantRetard: number | string;
};

type ClientStatsRPC = { total: number | string; actifs: number | string; solde_total: number | string };
type TourneeRow = { tournee_id: string; cout_total: number | null };
type ProduitRow = { produit_id: string | null; titre: string | null; stock: number | null; seuil_alerte: number | null };

// Une réponse incomplète ou illisible ne doit jamais s'afficher comme un chiffre fiable :
// le tableau de bord passe alors en état d'erreur au lieu de montrer 0.
export class DashboardDataError extends Error {}

// Montant obligatoire : 0 est légitime, une valeur absente ou non numérique ne l'est pas.
// Les numeric Postgres arrivent parfois en texte ("1234.50"), d'où l'acceptation des chaînes.
export function requireNumber(value: unknown, field: string): number {
  if (value === null || value === undefined || value === "") {
    throw new DashboardDataError(`Tableau de bord : champ « ${field} » absent`);
  }
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n)) {
    throw new DashboardDataError(`Tableau de bord : champ « ${field} » invalide`);
  }
  return n;
}

function requireArray<T>(value: unknown, field: string): T[] {
  if (!Array.isArray(value)) throw new DashboardDataError(`Tableau de bord : champ « ${field} » absent`);
  return value as T[];
}

// L'API Supabase plafonne chaque lecture (max-rows, 1 000 par défaut) : sans pagination,
// les frais de tournées seraient sous-estimés et des alertes de stock manqueraient.
// Pagination par clé (key > dernière clé lue, triée sur une clé unique) plutôt que par
// décalage : une ligne ajoutée ou supprimée pendant la lecture ne décale pas les pages,
// donc ni doublon ni ligne sautée parmi celles qui existaient au début de la lecture.
// La lecture s'arrête sur une page vide, pas sur une page « incomplète » : si max-rows
// est réglé plus bas que PAGE, une page courte ne signifie pas que tout a été lu.
export const PAGE = 1000;
export async function fetchAllByKey<T, K extends keyof T>(
  key: K,
  page: (after: T[K] | null) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const all: T[] = [];
  let after: T[K] | null = null;
  for (;;) {
    const { data, error } = await page(after);
    if (error) throw error;
    if (!data || data.length === 0) return all;
    all.push(...data);
    const last = data[data.length - 1][key];
    if (last === null || last === undefined || last === after) {
      throw new DashboardDataError("Tableau de bord : pagination bloquée (clé de tri absente)");
    }
    after = last;
  }
}

export type DashboardRaw = {
  clientsStats: unknown;
  overview: unknown;
  tournees: TourneeRow[];
  produits: ProduitRow[];
  now?: Date;
};

export function buildDashboardOverview({ clientsStats, overview, tournees, produits, now = new Date() }: DashboardRaw) {
  if (!clientsStats || typeof clientsStats !== "object") {
    throw new DashboardDataError("Tableau de bord : statistiques clients absentes");
  }
  if (!overview || typeof overview !== "object") {
    throw new DashboardDataError("Tableau de bord : indicateurs absents");
  }
  const cs = clientsStats as Partial<ClientStatsRPC>;
  const ov = overview as Partial<DashboardFullRPC>;

  const buckets: { key: string; name: string; ca: number; nb: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ key: `${d.getFullYear()}-${d.getMonth() + 1}`, name: MOIS[d.getMonth()], ca: 0, nb: 0 });
  }
  const idx = new Map(buckets.map((b, i) => [b.key, i]));
  for (const m of requireArray<{ y: number; m: number; ca: unknown; nb: unknown }>(ov.caMensuel, "caMensuel")) {
    const i = idx.get(`${m.y}-${m.m}`);
    if (i !== undefined) {
      buckets[i].ca = requireNumber(m.ca, "caMensuel.ca");
      buckets[i].nb = requireNumber(m.nb, "caMensuel.nb");
    }
  }

  // Une tournée sans coût saisi (cout_total NULL) ne coûte rien : 0 est ici la règle métier.
  const fraisTournees = tournees.reduce((a, r) => a + (r.cout_total ?? 0), 0);

  // Stock réel = somme des stocks par dépôt (v_produits). Un seuil à 0 ou absent signifie
  // « pas d'alerte pour ce produit ». Liste et compteur viennent de la même liste, avec la
  // même règle : la RPC renvoie un nbStockBas figé à 0 qui n'est donc plus lu.
  const stockBas = produits
    .map((p) => ({ titre: p.titre ?? "", stock: p.stock ?? 0, seuil_alerte: p.seuil_alerte ?? 0 }))
    .filter((p) => p.seuil_alerte > 0 && p.stock <= p.seuil_alerte)
    .sort((a, b) => a.stock - b.stock);

  return {
    clientsTotal: requireNumber(cs.total, "clients.total"),
    clientsActifs: requireNumber(cs.actifs, "clients.actifs"),
    soldeTotal: requireNumber(cs.solde_total, "clients.solde_total"),
    nbCommandes: requireNumber(ov.nbCommandes, "nbCommandes"),
    caTotal: requireNumber(ov.caTotal, "caTotal"),
    montantFacture: requireNumber(ov.montantFacture, "montantFacture"),
    montantEncaisse: requireNumber(ov.montantEncaisse, "montantEncaisse"),
    resteAEncaisser: requireNumber(ov.resteAEncaisser, "resteAEncaisser"),
    tauxEncaissement: requireNumber(ov.tauxEncaissement, "tauxEncaissement"),
    parStatut: requireArray<{ statut: string; count: unknown }>(ov.parStatut, "parStatut").map((s) => ({
      statut: s.statut,
      count: requireNumber(s.count, "parStatut.count"),
    })),
    caMensuel: buckets,
    recettes: requireNumber(ov.recettes, "recettes"),
    depenses: requireNumber(ov.depenses, "depenses"),
    solde: requireNumber(ov.solde, "solde"),
    stockBas,
    nbStockBas: stockBas.length,
    nbRetards: requireNumber(ov.nbRetards, "nbRetards"),
    montantRetard: requireNumber(ov.montantRetard, "montantRetard"),
    fraisTournees,
  };
}

export function useDashboardOverview(periode: Periode, exerciceId: string | null) {
  return useQuery({
    queryKey: ["dashboard-overview", periode, exerciceId],
    enabled: !!exerciceId,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      // Agrégat 100% serveur : une seule RPC pour toutes les métriques du dashboard,
      // + la RPC clients (déjà agrégée). Évite le transfert de milliers de lignes.
      // Même borne que la RPC (current_date - N, UTC = heure d'Abidjan).
      const sinceIso = new Date(Date.now() - Number(periode) * 86400000)
        .toISOString()
        .slice(0, 10);
      const [clientsStats, overview, tournees, produits] = await Promise.all([
        supabase.rpc("dashboard_client_stats").single(),
        supabase.rpc("dashboard_overview_full" as never, {
          _exercice_id: exerciceId!,
          _periode_jours: Number(periode),
        } as never),
        fetchAllByKey<TourneeRow, "tournee_id">("tournee_id", (after) => {
          let q = supabase
            .from("tournees")
            .select("tournee_id, cout_total")
            .gte("date_tournee", sinceIso)
            .order("tournee_id")
            .limit(PAGE);
          if (after) q = q.gt("tournee_id", after);
          return q;
        }),
        fetchAllByKey<ProduitRow, "produit_id">("produit_id", (after) => {
          let q = supabase
            .from("v_produits")
            .select("produit_id, titre, stock, seuil_alerte")
            .eq("actif", true)
            .order("produit_id")
            .limit(PAGE);
          if (after) q = q.gt("produit_id", after);
          return q;
        }),
      ]);

      // Une requête en échec doit afficher l'erreur, jamais des indicateurs à 0.
      if (clientsStats.error) throw clientsStats.error;
      if (overview.error) throw overview.error;
      return buildDashboardOverview({
        clientsStats: clientsStats.data,
        overview: overview.data,
        tournees,
        produits,
      });
    },
  });
}

export type DashboardOverview = NonNullable<ReturnType<typeof useDashboardOverview>["data"]>;
