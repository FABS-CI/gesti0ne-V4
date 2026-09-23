import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useEffect, useMemo, useState } from "react";
import { ShoppingCart } from "lucide-react";
import { AdvancedSearchBar, type AdvancedFilters } from "@/components/search/AdvancedSearchBar";
import { type Commande, STATUTS_COMMANDE } from "@/lib/commandes-api";
import { FilterBadges, type FilterBadge } from "@/components/common/FilterBadges";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useExerciceConsulteId } from "@/contexts/ExerciceContext";
import { useUserRoles } from "@/hooks/use-user-roles";
import { usePermissions } from "@/hooks/use-permissions";
import { useCommandesList } from "@/hooks/use-commandes-list";
import { CommandesCycleSteps } from "@/components/commandes/list/CommandesCycleSteps";
import { CommandesKpis } from "@/components/commandes/list/CommandesKpis";
import { CommandesToolbar } from "@/components/commandes/list/CommandesToolbar";
import { CommandesTable } from "@/components/commandes/list/CommandesTable";
import { DeleteCommandeDialog } from "@/components/commandes/list/DeleteCommandeDialog";
import { FraisTransportDialog } from "@/components/commandes/FraisTransportDialog";
import { exportCommandesCsv, exportCommandesPdf } from "@/lib/commandes-list-export";
import { TablePagination } from "@/components/layout/TablePagination";
import { RenderProfiler } from "@/hooks/use-render-profiler";
import { SkeletonTable, SkeletonKpiRow } from "@/components/ui/skeletons";

import { authRouteHead } from "@/lib/route-head";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
const COMMANDES_PAGE_SIZE = 50;

export const Route = createFileRoute("/_authenticated/commandes/")({
  head: () => authRouteHead("Commandes"),
  validateSearch: zodValidator(
    z.object({
      q: fallback(z.string(), "").default(""),
      statut: fallback(z.string(), "all").default("all"),
      clientId: fallback(z.string().optional(), undefined).default(undefined),
      page: fallback(z.number().int().min(1), 1).default(1),
    }),
  ),
  pendingMs: 200,
  pendingComponent: CommandesPending,
  component: CommandesPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function CommandesPending() {
  return (
    <div className="space-y-6">
      <div className="h-9 w-64 animate-pulse rounded bg-muted" />
      <SkeletonKpiRow count={4} />
      <div className="rounded-xl border bg-card p-4">
        <SkeletonTable rows={8} cols={6} />
      </div>
    </div>
  );
}

function CommandesPage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const sp = Route.useSearch();
  const [search, setSearch] = useState(sp.q);
  const statut = sp.statut;
  const page = sp.page;
  const q = useDebouncedValue(search, 300);
  const [advanced, setAdvanced] = useState<AdvancedFilters>({});
  const exerciceId = useExerciceConsulteId();
  const { isSuperAdmin } = useUserRoles();
  const { has: hasPermission } = usePermissions();
  const canValider = hasPermission("commandes.valider");
  const canModifier = hasPermission("commandes.modifier");
  const readOnly = !canModifier && !hasPermission("commandes.creer");
  const [commandeToDelete, setCommandeToDelete] = useState<Commande | null>(null);
  // Commande en attente de confirmation dans la fenêtre « Frais de transport ».
  const [commandeAValider, setCommandeAValider] = useState<string | null>(null);

  useEffect(() => {
    if (q !== sp.q) {
      navigate({
        search: (prev: { q: string; statut: string; page: number }) => ({ ...prev, q, page: 1 }),
        replace: true,
      });
    }
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!sp.clientId) return;
    navigate({ to: "/commandes/nouvelle", search: { clientId: sp.clientId } });
  }, [sp.clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isLoading, deleteMutation, validerMutation } = useCommandesList({
    q,
    statut,
    advanced,
    exerciceId,
    page,
    pageSize: COMMANDES_PAGE_SIZE,
  });

  const setStatut = (v: string) =>
    navigate({
      search: (prev: { q: string; statut: string; page: number }) => ({
        ...prev,
        statut: v,
        page: 1,
      }),
      replace: true,
    });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const hasAdvanced = Object.values(advanced).some(
    (v) => v !== undefined && v !== null && v !== "",
  );
  const hasActiveFilters = !!q || statut !== "all" || hasAdvanced;
  const statutLabel = STATUTS_COMMANDE.find((s) => s.value === statut)?.label ?? statut;
  const resetAllFilters = () => {
    setSearch("");
    setAdvanced({});
    navigate({ search: { q: "", statut: "all", page: 1 }, replace: true });
  };

  const setPage = (p: number) =>
    navigate({
      search: (prev: { q: string; statut: string; page: number }) => ({ ...prev, page: p }),
      replace: true,
    });

  const kpis = useMemo(() => {
    const now = new Date();
    const moisCount = items.filter((c) => {
      const d = new Date(c.date_commande);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    const ca = items.reduce((s, c) => s + (c.montant_total || 0), 0);
    const enAttente = items.filter(
      (c) => c.statut === "brouillon" || c.statut === "confirmee",
    ).length;
    const livrees = items.filter((c) => c.statut === "livree").length;
    return { moisCount, ca, enAttente, livrees };
  }, [items]);

  return (
    <RenderProfiler id="page:commandes">
      <div className="space-y-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold tracking-tight">Ventes &amp; Commandes</h1>
              <p className="text-sm text-muted-foreground">Pilotez le cycle de vente complet</p>
            </div>
          </div>
        </div>

        <CommandesCycleSteps />
        <CommandesKpis kpis={kpis} />

        <CommandesToolbar
          search={search}
          onSearchChange={setSearch}
          statut={statut}
          onStatutChange={setStatut}
          readOnly={readOnly}
          onExportCsv={() => exportCommandesCsv(items)}
          onExportPdf={() => exportCommandesPdf(items, q, statut, advanced)}
          hasItems={items.length > 0}
        />

        <FilterBadges
          badges={
            [
              q && {
                key: "q",
                label: `Recherche : ${q}`,
                onClear: () => {
                  setSearch("");
                  navigate({
                    search: (prev: { q: string; statut: string; page: number }) => ({
                      ...prev,
                      q: "",
                      page: 1,
                    }),
                    replace: true,
                  });
                },
              },
              statut !== "all" && {
                key: "statut",
                label: `Statut : ${statutLabel}`,
                onClear: () => setStatut("all"),
              },
              hasAdvanced && {
                key: "advanced",
                label: "Filtres avancés",
                onClear: () => setAdvanced({}),
              },
            ].filter(Boolean) as FilterBadge[]
          }
          onResetAll={resetAllFilters}
        />

        <div className="rounded-xl border bg-card p-3 shadow-sm">
          <AdvancedSearchBar
            fields={[
              "reference",
              "client",
              "telephone",
              "commercial",
              "ville",
              "dates",
              "montants",
            ]}
            value={advanced}
            onChange={setAdvanced}
          />
        </div>

        <CommandesTable
          items={items}
          isLoading={isLoading}
          q={q}
          statut={statut}
          onResetFilters={resetAllFilters}
          readOnly={readOnly}
          isSuperAdmin={isSuperAdmin}
          canModifier={canModifier}
          canValider={canValider}
          onValider={(id) => setCommandeAValider(id)}
          validerPending={validerMutation.isPending}
          onDelete={setCommandeToDelete}
        />

        <TablePagination
          page={page}
          pageSize={COMMANDES_PAGE_SIZE}
          total={total}
          onPageChange={setPage}
        />

        <DeleteCommandeDialog
          commande={commandeToDelete}
          onOpenChange={(o) => !o && setCommandeToDelete(null)}
          pending={deleteMutation.isPending}
          onConfirm={(motif, force) => {
            if (!commandeToDelete) return;
            deleteMutation.mutate(
              { id: commandeToDelete.commande_id, motif, force },
              { onSettled: () => setCommandeToDelete(null) },
            );
          }}
        />

        <FraisTransportDialog
          open={commandeAValider !== null}
          reference={items.find((c) => c.commande_id === commandeAValider)?.reference}
          pending={validerMutation.isPending}
          onOpenChange={(o) => !o && !validerMutation.isPending && setCommandeAValider(null)}
          onConfirm={(frais) => {
            if (!commandeAValider || validerMutation.isPending) return;
            validerMutation.mutate(
              { id: commandeAValider, frais },
              { onSuccess: () => setCommandeAValider(null) },
            );
          }}
        />

      </div>
    </RenderProfiler>
  );
}
