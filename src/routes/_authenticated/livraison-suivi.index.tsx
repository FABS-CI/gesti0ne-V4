import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, Search, Truck } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AvancerEtapeDialog } from "@/components/livraison-suivi/AvancerEtapeDialog";
import { LivraisonsTable } from "@/components/livraison-suivi/LivraisonsTable";
import {
  listCommandesSuivi,
  STATUT_LABEL,
  type LivStatut,
  type LivSuiviCommande,
  type LivType,
} from "@/lib/livraison-suivi-api";
import type { ColisInfo } from "@/lib/livraison-suivi/types";
import { computeSuiviDefaults } from "@/lib/livraison-suivi/defaults";

import { authRouteHead } from "@/lib/route-head";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
export const Route = createFileRoute("/_authenticated/livraison-suivi/")({
  head: () => authRouteHead("Suivi de livraison"),
  component: LivraisonSuiviIndex,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function LivraisonSuiviIndex() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<LivType | "all">("all");
  const [statutFilter, setStatutFilter] = useState<LivStatut | "all">("all");
  const [tourneeFilter, setTourneeFilter] = useState<string>("");
  const [pageSize, setPageSize] = useState<number>(25);
  const [target, setTarget] = useState<
    (LivSuiviCommande & { colis?: ColisInfo | null }) | null
  >(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["livsuivi", "list"],
    queryFn: () => listCommandesSuivi(),
    // Pas de polling : la souscription realtime ci-dessous invalide
    // le cache dès qu'une ligne livsuivi_* change.
    staleTime: 30_000,
  });

  useEffect(() => {
    const ch = supabase
      .channel("livsuivi-index")
      .on("postgres_changes", { event: "*", schema: "public", table: "livsuivi_commandes" }, () =>
        qc.invalidateQueries({ queryKey: ["livsuivi"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "livsuivi_historique" }, () =>
        qc.invalidateQueries({ queryKey: ["livsuivi"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const filtered = useMemo(() => {
    return data.filter((r) => {
      if (typeFilter !== "all" && r.type_livraison !== typeFilter) return false;
      if (statutFilter !== "all" && r.statut !== statutFilter) return false;
      if (tourneeFilter) {
        const ref = r.tournee?.reference?.toLowerCase() ?? "";
        if (!ref.includes(tourneeFilter.toLowerCase())) return false;
      }
      if (q) {
        const t = q.toLowerCase();
        if (
          !r.commande?.reference?.toLowerCase().includes(t) &&
          !r.commande?.client_nom?.toLowerCase().includes(t) &&
          !r.commande?.ville?.toLowerCase().includes(t)
        )
          return false;
      }
      return true;
    });
  }, [data, typeFilter, statutFilter, tourneeFilter, q]);

  const paginated = useMemo(
    () => filtered.slice(0, pageSize),
    [filtered, pageSize],
  );

  const stats = useMemo(() => {
    const total = data.length;
    const enCours = data.filter((r) => !r.cloturee).length;
    const livrees = data.filter((r) => r.cloturee).length;
    return { total, enCours, livrees };
  }, [data]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Truck className="h-7 w-7 text-primary" />
        <div>
          <h1 className="ds-page-title">Suivi des livraisons</h1>
          <p className="text-sm text-muted-foreground">
            Pilotage temps réel des livraisons — responsable logistique
          </p>
        </div>
        <div className="ml-auto" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total commandes" value={stats.total} icon={<Package />} />
        <StatCard label="En cours" value={stats.enCours} icon={<Truck />} />
        <StatCard label="Terminées" value={stats.livrees} icon={<Truck />} />
      </div>

      <div className="rounded-md border bg-card p-4 space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Réf, client, ville…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as LivType | "all")}>
            <SelectTrigger>
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous types</SelectItem>
              <SelectItem value="direct">Livraison directe</SelectItem>
              <SelectItem value="expedition">Expédition</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={statutFilter}
            onValueChange={(v) => setStatutFilter(v as LivStatut | "all")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              {(Object.keys(STATUT_LABEL) as LivStatut[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUT_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <Input
            placeholder="N° tournée (ex: TR-2026-001)"
            value={tourneeFilter}
            onChange={(e) => setTourneeFilter(e.target.value)}
            className="font-mono"
          />
        </div>

        <LivraisonsTable rows={paginated} isLoading={isLoading} onAdvance={setTarget} />
        <div className="flex items-center justify-end gap-2 pt-2 text-xs text-muted-foreground">
          <span>Lignes par page</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => setPageSize(Number(v))}
          >
            <SelectTrigger
              className="h-8 w-20"
              aria-label="Lignes par page"
              data-testid="livsuivi-page-size"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
          <span data-testid="livsuivi-count">
            {paginated.length} / {filtered.length}
          </span>
        </div>
      </div>

      <AvancerEtapeDialog
        target={target}
        defaults={target ? computeSuiviDefaults(target) : undefined}
        onClose={() => setTarget(null)}
      />
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-card p-4 flex items-center gap-4">
      <div className="p-2 rounded-md bg-primary/10 text-primary">{icon}</div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold">{value}</div>
      </div>
    </div>
  );
}
