import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { RapportFilterBar } from "@/components/rapports/analyse/filtres/RapportFilterBar";
import {
  getRapportEvolution,
  getRapportKpi,
  getRapportProduits,
  type RapportFilters,
} from "@/lib/rapports-api";
import { RapportKpisGrid } from "@/components/rapports/analyse/RapportKpisGrid";
import { EvolutionCard } from "@/components/rapports/analyse/EvolutionCard";
import { AnalyseZone } from "@/components/rapports/analyse/AnalyseZone";
import { VentesEncart } from "@/components/rapports/analyse/VentesEncart";
import type { DetailTarget } from "@/components/rapports/analyse/DetailSheet";
import { previousPeriode } from "@/lib/rapports-periode";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import {
  DIM_FILTER_KEY,
  rapportAnalyseSearchSchema,
  searchToFilters,
  filtersToSearch,
  type RapportAnalyseSearch,
} from "@/lib/rapports-search";

export const Route = createFileRoute("/_authenticated/rapports/analyse")({
  validateSearch: (s: Record<string, unknown>) => rapportAnalyseSearchSchema.parse(s),
  component: RapportsAnalysePage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function RapportsAnalysePage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const update = (patch: Partial<RapportAnalyseSearch>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }) });
  const filters = searchToFilters(search);
  const setFilters = (v: RapportFilters) => update({ ...filtersToSearch(v), page: undefined });
  const tri = search.tri ?? "ca";
  const sens = search.sens ?? "desc";
  const page = search.page ?? 1;
  const pageSize = search.ps ?? 50;
  const granularite = search.gran ?? "mois";
  const dim = search.dim ?? "produits";
  const compare = !!search.cmp && !!filters.from && !!filters.to;
  const prevFilters = compare
    ? { ...filters, ...previousPeriode(filters.from as string, filters.to as string) }
    : null;

  const kpiQ = useQuery({
    queryKey: ["rap-kpi", filters],
    queryFn: () => getRapportKpi(filters),
    staleTime: 60_000,
  });
  const kpiPrevQ = useQuery({
    queryKey: ["rap-kpi", prevFilters],
    queryFn: () => getRapportKpi(prevFilters ?? {}),
    enabled: !!prevFilters,
    staleTime: 60_000,
  });
  const evoQ = useQuery({
    queryKey: ["rap-evo", filters, granularite],
    queryFn: () => getRapportEvolution(filters, granularite),
    staleTime: 60_000,
  });
  const evoPrevQ = useQuery({
    queryKey: ["rap-evo", prevFilters, granularite],
    queryFn: () => getRapportEvolution(prevFilters ?? {}, granularite),
    enabled: !!prevFilters,
    staleTime: 60_000,
  });
  // Toujours chargé : fournit aussi le nombre de produits affiché sous les filtres.
  const listQ = useQuery({
    queryKey: ["rap-list", filters, tri, sens, page, pageSize],
    queryFn: () => getRapportProduits(filters, tri, sens, page, pageSize),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const onSort = (key: string) => {
    if (tri === key) update({ sens: sens === "asc" ? "desc" : "asc", page: undefined });
    else update({ tri: key, sens: "desc", page: undefined });
  };

  const filterOn = (t: DetailTarget) => {
    if (t.kind === "produit") {
      const cur = filters.produits ?? [];
      setFilters({ ...filters, produits: [...new Set([...cur, t.row.produit_id])] });
    } else {
      const k = DIM_FILTER_KEY[t.dim];
      const cur = filters[k] ?? [];
      setFilters({ ...filters, [k]: [...new Set([...cur, t.row.label])] });
    }
  };

  return (
    <div className="theme-dashboard space-y-5">
      <div>
        <h1 className="ds-page-title">Analyse des ventes & produits</h1>
        <p className="text-sm text-muted-foreground">
          Chiffre d'affaires, produits et clients, par période et par dimension.
        </p>
      </div>

      <RapportFilterBar
        value={filters}
        onChange={setFilters}
        compare={compare}
        onCompareChange={(v) => update({ cmp: v || undefined })}
        nbProduits={listQ.data?.total}
        nbClients={kpiQ.data?.nb_clients}
      />

      <RapportKpisGrid data={kpiQ.data} previous={kpiPrevQ.data} compare={compare} />

      <EvolutionCard
        data={evoQ.data}
        previous={compare ? evoPrevQ.data : undefined}
        isLoading={evoQ.isLoading}
        isError={evoQ.isError}
        granularite={granularite}
        onGranularite={(g) => update({ gran: g === "mois" ? undefined : g })}
      />

      <AnalyseZone
        dim={dim}
        onDim={(d) => update({ dim: d === "produits" ? undefined : d, page: undefined })}
        filters={filters}
        onFilter={filterOn}
        onClearFilters={() => setFilters({})}
        produits={{
          rows: listQ.data?.items ?? [],
          total: listQ.data?.total ?? 0,
          isLoading: listQ.isLoading,
        }}
        tri={tri}
        sens={sens}
        onSort={onSort}
        page={page}
        onPage={(p) => update({ page: p > 1 ? p : undefined })}
        pageSize={pageSize}
        onPageSize={(n) => update({ ps: n === 50 ? undefined : (n as 25 | 50 | 100), page: undefined })}
      />

      <VentesEncart filters={filters} />
    </div>
  );
}
