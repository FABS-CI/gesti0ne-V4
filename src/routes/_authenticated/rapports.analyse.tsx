import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RapportFiltersPanel } from "@/components/rapports/RapportFiltersPanel";
import {
  getRapportAgregat,
  getRapportEvolution,
  getRapportFlop,
  getRapportKpi,
  getRapportProduits,
  getRapportTopProduits,
  type RapportFilters,
} from "@/lib/rapports-api";
import { AgregatBar, AgregatPie, EvolutionLineChart } from "@/components/rapports/RapportCharts";
import { RapportKpisGrid } from "@/components/rapports/analyse/RapportKpisGrid";
import { AgregatCard } from "@/components/rapports/analyse/AgregatCard";
import { ProduitsTab } from "@/components/rapports/analyse/ProduitsTab";
import { TopFlopTab } from "@/components/rapports/analyse/TopFlopTab";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { Skeleton } from "@/components/ui/skeleton";
import {
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
  const tri = search.tri ?? "ca";
  const sens = search.sens ?? "desc";
  const page = search.page ?? 1;
  const topN = search.top ?? 20;
  const granularite = search.gran ?? "mois";
  const onglet = search.onglet ?? "produits";
  const setPage = (p: number) => update({ page: p > 1 ? p : undefined });

  const kpiQ = useQuery({
    queryKey: ["rap-kpi", filters],
    queryFn: () => getRapportKpi(filters),
    staleTime: 60_000,
  });
  const listQ = useQuery({
    queryKey: ["rap-list", filters, tri, sens, page],
    queryFn: () => getRapportProduits(filters, tri, sens, page, 50),
    staleTime: 60_000,
  });
  const topQ = useQuery({
    queryKey: ["rap-top", filters, topN],
    queryFn: () => getRapportTopProduits(filters, topN),
    staleTime: 60_000,
  });
  const flopQ = useQuery({
    queryKey: ["rap-flop", filters],
    queryFn: () => getRapportFlop(filters),
    staleTime: 60_000,
  });
  const nivQ = useQuery({
    queryKey: ["rap-agg", "niveau", filters],
    queryFn: () => getRapportAgregat(filters, "niveau"),
    staleTime: 60_000,
  });
  const catQ = useQuery({
    queryKey: ["rap-agg", "categorie", filters],
    queryFn: () => getRapportAgregat(filters, "categorie"),
    staleTime: 60_000,
  });
  const vilQ = useQuery({
    queryKey: ["rap-agg", "ville", filters],
    queryFn: () => getRapportAgregat(filters, "ville"),
    staleTime: 60_000,
  });
  const quaQ = useQuery({
    queryKey: ["rap-agg", "quartier", filters],
    queryFn: () => getRapportAgregat(filters, "quartier"),
    staleTime: 60_000,
  });
  const evoQ = useQuery({
    queryKey: ["rap-evo", filters, granularite],
    queryFn: () => getRapportEvolution(filters, granularite),
    staleTime: 60_000,
  });

  const listRows = listQ.data?.items ?? [];
  const onSort = (key: string) => {
    if (tri === key) update({ sens: sens === "asc" ? "desc" : "asc", page: undefined });
    else update({ tri: key, sens: "desc", page: undefined });
  };

  return (
    <div className="theme-dashboard space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="ds-page-title flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" /> Analyse des ventes & produits
          </h1>
          <p className="text-sm text-muted-foreground">
            Chiffre d'affaires, produits et clients, par période et par dimension.
          </p>
        </div>
      </div>

      <RapportFiltersPanel
        value={filters}
        onChange={(v) => update({ ...filtersToSearch(v), page: undefined })}
      />

      <RapportKpisGrid data={kpiQ.data} />

      <Tabs
        value={onglet}
        onValueChange={(v) =>
          update({ onglet: v === "produits" ? undefined : (v as RapportAnalyseSearch["onglet"]) })
        }
      >
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="produits">Produits (détail)</TabsTrigger>
          <TabsTrigger value="top">Top / Flop</TabsTrigger>
          <TabsTrigger value="niveaux">Niveaux</TabsTrigger>
          <TabsTrigger value="categories">Catégories</TabsTrigger>
          <TabsTrigger value="geo">Géographie</TabsTrigger>
          <TabsTrigger value="evolution">Évolution</TabsTrigger>
        </TabsList>

        <TabsContent value="produits" className="space-y-4">
          <ProduitsTab
            rows={listRows}
            total={listQ.data?.total ?? 0}
            isLoading={listQ.isLoading}
            tri={tri}
            sens={sens}
            onSort={onSort}
            page={page}
            onPage={setPage}
            filters={filters}
          />
        </TabsContent>

        <TabsContent value="top">
          <TopFlopTab topN={topN} onTopN={(n) => update({ top: n === 20 ? undefined : (n as 10 | 50) })} top={topQ.data} flop={flopQ.data} />
        </TabsContent>

        {/* NIVEAUX */}
        <TabsContent value="niveaux" className="space-y-4">
          <AgregatCard title="Ventes par niveau scolaire" data={nivQ.data ?? []} isLoading={nivQ.isLoading} />
          {nivQ.data && (
            <Card>
              <CardContent className="pt-4">
                <AgregatBar data={nivQ.data} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* CATEGORIES */}
        <TabsContent value="categories" className="space-y-4">
          <AgregatCard title="Ventes par catégorie" data={catQ.data ?? []} isLoading={catQ.isLoading} />
          {catQ.data && (
            <Card>
              <CardContent className="pt-4">
                <AgregatPie data={catQ.data} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* GEO */}
        <TabsContent value="geo" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <AgregatCard title="Ventes par ville" data={vilQ.data ?? []} isLoading={vilQ.isLoading} />
            <AgregatCard title="Ventes par quartier / commune" data={quaQ.data ?? []} isLoading={quaQ.isLoading} />
          </div>
          {vilQ.data && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">CA par ville</CardTitle>
              </CardHeader>
              <CardContent>
                <AgregatBar data={vilQ.data} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* EVOLUTION */}
        <TabsContent value="evolution" className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm">Granularité</span>
            <Select value={granularite} onValueChange={(v) => update({ gran: v === "mois" ? undefined : (v as RapportAnalyseSearch["gran"]) })}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="jour">Jour</SelectItem>
                <SelectItem value="semaine">Semaine</SelectItem>
                <SelectItem value="mois">Mois</SelectItem>
                <SelectItem value="annee">Année</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {evoQ.isLoading && <Skeleton className="h-72 w-full" />}
          {evoQ.data && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Évolution des ventes</CardTitle>
              </CardHeader>
              <CardContent>
                <EvolutionLineChart data={evoQ.data} />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
