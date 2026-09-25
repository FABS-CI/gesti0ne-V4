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
  nbStockBas: number;
  stockBas: { titre: string; stock: number; seuil_alerte: number }[];
};

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
      const sinceIso = new Date(Date.now() - Number(periode) * 86400000)
        .toISOString()
        .slice(0, 10);
      const [clientsStats, overview, tournees, alertes] = await Promise.all([
        supabase.rpc("dashboard_client_stats").single(),
        supabase.rpc("dashboard_overview_full" as never, {
          _exercice_id: exerciceId!,
          _periode_jours: Number(periode),
        } as never),
        supabase
          .from("tournees")
          .select("cout_total")
          .gte("date_tournee", sinceIso),
        supabase.from("stocks_depots").select("quantite, seuil_alerte"),
      ]);

      const cs = (clientsStats.data ?? { total: 0, actifs: 0, solde_total: 0 }) as {
        total: number | string;
        actifs: number | string;
        solde_total: number | string;
      };
      const clientsTotalCount = Number(cs.total) || 0;
      const clientsActifsCount = Number(cs.actifs) || 0;
      const soldeTotal = Number(cs.solde_total) || 0;

      const ov = (overview.data ?? {}) as Partial<DashboardFullRPC>;
      const fraisTournees = (tournees.data ?? []).reduce(
        (a, r) => a + Number(r.cout_total ?? 0),
        0,
      );
      const now = new Date();
      const buckets: { key: string; name: string; ca: number; nb: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        buckets.push({
          key: `${d.getFullYear()}-${d.getMonth() + 1}`,
          name: MOIS[d.getMonth()],
          ca: 0,
          nb: 0,
        });
      }
      const idx = new Map(buckets.map((b, i) => [b.key, i]));
      for (const m of ov.caMensuel ?? []) {
        const k = `${m.y}-${m.m}`;
        const i = idx.get(k);
        if (i !== undefined) {
          buckets[i].ca = Number(m.ca) || 0;
          buckets[i].nb = Number(m.nb) || 0;
        }
      }

      if (overview.error) throw overview.error;
      // Liste et compteur issus de la même source (RPC) pour rester cohérents.
      const stockBasList = ov.stockBas ?? [];
      void alertes;

      return {
        clientsTotal: clientsTotalCount,
        clientsActifs: clientsActifsCount,
        soldeTotal,
        nbCommandes: Number(ov.nbCommandes) || 0,
        caTotal: Number(ov.caTotal) || 0,
        montantFacture: Number(ov.montantFacture) || 0,
        montantEncaisse: Number(ov.montantEncaisse) || 0,
        resteAEncaisser: Number(ov.resteAEncaisser) || 0,
        tauxEncaissement: Number(ov.tauxEncaissement) || 0,
        parStatut: (ov.parStatut ?? []).map((s) => ({
          statut: s.statut,
          count: Number(s.count) || 0,
        })),
        caMensuel: buckets,
        recettes: Number(ov.recettes) || 0,
        depenses: Number(ov.depenses) || 0,
        solde: Number(ov.solde) || 0,
        stockBas: stockBasList,
        nbStockBas: Math.max(Number(ov.nbStockBas) || 0, stockBasList.length),
        nbRetards: Number(ov.nbRetards) || 0,
        montantRetard: Number(ov.montantRetard) || 0,
        fraisTournees,
      };
    },
  });
}

export type DashboardOverview = NonNullable<ReturnType<typeof useDashboardOverview>["data"]>;
