import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Plus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import {
  type Client,
  deleteClient,
  disableClient,
  listClients,
} from "@/lib/clients-api";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useActifsExerciceIds } from "@/hooks/use-actifs-exercice";
import { usePermissions } from "@/hooks/use-permissions";
import { CrmFiltersPanel } from "@/components/clients/CrmFilters";
import { searchClientsCrm, type CrmFilters } from "@/lib/crm-api";
import { describeSupabaseError } from "@/lib/rbac-api";
import {
  PAGE_SIZE,
  exportClientsPdf,
  isCrmActive,
} from "@/lib/clients-index-helpers";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClientsFilters } from "@/components/clients/list/ClientsFilters";
import { ClientsTable } from "@/components/clients/list/ClientsTable";
import { RenderProfiler } from "@/hooks/use-render-profiler";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";

import { authRouteHead } from "@/lib/route-head";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { friendlyError } from "@/lib/friendly-error";
export const Route = createFileRoute("/_authenticated/clients/")({
  head: () => authRouteHead("Clients"),
  validateSearch: z.object({ edit: z.string().optional() }),
  component: ClientsPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function ClientsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { has: hasPermission } = usePermissions();
  const readOnly = !hasPermission("clients.creer") && !hasPermission("clients.modifier");
  const { edit: editId } = Route.useSearch();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [actifFilter, setActifFilter] = useState("true");
  const [actifsExercice, setActifsExercice] = useState(false);
  const [page, setPage] = useState(1);
  const [crmFilters, setCrmFilters] = useState<CrmFilters>({});
  const [filtersOpen, setFiltersOpen] = useState(false);

  const q = useDebouncedValue(search, 300);

  const crmActive = isCrmActive(crmFilters);

  const hasActiveFilters =
    !!search ||
    typeFilter !== "all" ||
    actifFilter !== "true" ||
    actifsExercice ||
    crmActive;

  const resetAllFilters = () => {
    setSearch("");
    setTypeFilter("all");
    setActifFilter("true");
    setActifsExercice(false);
    setCrmFilters({});
    setPage(1);
  };

  const { ids: actifsIds, isLoading: isLoadingActifs } = useActifsExerciceIds(
    "client",
    actifsExercice,
  );
  const actifsClientIds = useMemo(
    () => (actifsExercice && actifsIds ? [...actifsIds].sort() : null),
    [actifsExercice, actifsIds],
  );

  const { data, isLoading } = useQuery({
    queryKey: [
      "clients",
      q,
      typeFilter,
      actifFilter,
      page,
      crmActive,
      crmFilters,
      actifsExercice,
      actifsClientIds,
    ],
    enabled: !actifsExercice || !!actifsClientIds,
    queryFn: async () => {
      if (crmActive) {
        const actif = actifFilter === "all" ? undefined : actifFilter === "true";
        const pageSize = actifsClientIds ? 10_000 : PAGE_SIZE;
        const res = await searchClientsCrm(
          {
            ...crmFilters,
            q: q || crmFilters.q,
            actif,
          },
          actifsClientIds ? 1 : page,
          pageSize,
        );
        const filteredItems = actifsClientIds
          ? res.items.filter((c) => actifsClientIds.includes(c.client_id))
          : res.items;
        return {
          items: actifsClientIds
            ? (filteredItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) as unknown as Client[])
            : (filteredItems as unknown as Client[]),
          total: actifsClientIds ? filteredItems.length : res.total,
          page,
          pageSize: PAGE_SIZE,
        };
      }
      return listClients({
        q: q || undefined,
        type_client: typeFilter === "all" ? undefined : typeFilter,
        actif: actifFilter === "all" ? undefined : actifFilter === "true",
        clientIds: actifsClientIds ?? undefined,
        page,
        pageSize: PAGE_SIZE,
      });
    },
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });

  const disableMutation = useMutation({
    mutationFn: (id: string) => disableClient(id),
    onSuccess: () => {
      toast.success("Client désactivé");
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e) => {
      const d = describeSupabaseError(e);
      toast.error(d.title, { description: d.message });
    },
  });

  const [toDelete, setToDelete] = useState<Client | null>(null);
  const deleteMutation = useMutation({
    mutationFn: async ({ id, motif }: { id: string; motif: string | null }) => {
      try {
        return await deleteClient(id, motif);
      } catch (err) {
        // Garde métier : dépendances → on désactive à la place.
        const msg = err instanceof Error ? err.message : String(err);
        if (/foreign key|violates foreign|referenced|dependenc|référenc/i.test(msg)) {
          await disableClient(id);
          toast.info("Client référencé : désactivé au lieu d'être supprimé");
          return null;
        }
        throw err;
      }
    },
    onSuccess: (res) => {
      if (res !== null) toast.success("Client supprimé");
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setToDelete(null);
    },
    onError: (e) => {
      const d = describeSupabaseError(e);
      toast.error(d.title, { description: d.message });
    },
  });

  const rawItems = data?.items ?? [];
  const items = rawItems;
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (!editId) return;
    navigate({
      to: "/clients/$clientId/modifier",
      params: { clientId: editId },
      replace: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function handleExport() {
    try {
      const n = await exportClientsPdf({
        q: q || undefined,
        type_client: typeFilter === "all" ? undefined : typeFilter,
        actif: actifFilter === "all" ? undefined : actifFilter === "true",
      });
      toast.success(`${n} client(s) exporté(s)`);
    } catch (e) {
      toast.error(friendlyError(e, "Erreur export"));
    }
  }

  return (
    <RenderProfiler id="page:clients">
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold">Clients</h1>
            <p className="text-sm text-muted-foreground">{total} client(s)</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" /> Export PDF
            </Button>
            {!readOnly && (
              <Button onClick={() => navigate({ to: "/clients/nouveau" })}>
                <Plus className="mr-2 h-4 w-4" /> Nouveau client
              </Button>
            )}
          </div>
        </div>

        <ClientsFilters
          search={search}
          setSearch={setSearch}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          actifFilter={actifFilter}
          setActifFilter={setActifFilter}
          actifsExercice={actifsExercice}
          setActifsExercice={setActifsExercice}
          onAnyChange={() => setPage(1)}
        />

        {actifsExercice && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              Filtre : actifs dans l'exercice
              <button
                type="button"
                className="ml-1 rounded hover:bg-muted-foreground/20 px-1"
                onClick={() => {
                  setActifsExercice(false);
                  setPage(1);
                }}
                aria-label="Retirer le filtre"
              >
                ×
              </button>
            </Badge>
          </div>
        )}

        <CrmFiltersPanel
          value={crmFilters}
          onChange={(v) => {
            setCrmFilters(v);
            setPage(1);
          }}
        />

        <ClientsTable
          items={items}
          isLoading={isLoading || isLoadingActifs}
          readOnly={readOnly}
          onDisable={(c) => setToDelete(c)}
          hasActiveFilters={hasActiveFilters}
          onResetFilters={resetAllFilters}
        />

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-end gap-2">
            <span className="text-sm text-muted-foreground">
              Page {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Préc.
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Suiv.
            </Button>
          </div>
        )}

        <ConfirmDeleteDialog
          open={!!toDelete}
          onOpenChange={(o) => !o && setToDelete(null)}
          title="Supprimer ce client ?"
          entityLabel="le client"
          entityName={toDelete?.nom}
          description="La suppression est bloquée si le client possède des factures, commandes ou paiements. Dans ce cas, la fiche sera automatiquement désactivée."
          consequences={[
            "Historique CRM et duplicatas potentiels supprimés",
            "Si des documents financiers existent → désactivation automatique",
          ]}
          motifRequired
          pending={deleteMutation.isPending || disableMutation.isPending}
          onConfirm={(motif) => {
            if (!toDelete) return;
            deleteMutation.mutate({ id: toDelete.client_id, motif });
          }}
        />
      </div>
    </RenderProfiler>
  );
}
