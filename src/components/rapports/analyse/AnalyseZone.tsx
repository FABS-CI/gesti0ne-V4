import { lazy, Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getRapportAgregat, type RapportFilters, type ProduitLigneRapport } from "@/lib/rapports-api";
import { cleanSpaces, titleCaseVille } from "@/lib/rapports-labels";
import type { AnalyseDim } from "@/lib/rapports-search";
import { ProduitsTab } from "./ProduitsTab";
import { DimensionTable } from "./DimensionTable";
import { ExportMenu } from "./ExportMenu";
import { DetailSheet, type DetailTarget } from "./DetailSheet";
import { useAnalyseExport } from "./use-analyse-export";

const DimensionChart = lazy(() => import("./DimensionChart"));

const DIMS: [AnalyseDim, string][] = [
  ["produits", "Produits"],
  ["niveau", "Niveaux"],
  ["categorie", "Catégories"],
  ["ville", "Villes"],
  ["type", "Types de client"],
];

type Props = {
  dim: AnalyseDim;
  onDim: (d: AnalyseDim) => void;
  filters: RapportFilters;
  onFilter: (t: DetailTarget) => void;
  onClearFilters: () => void;
  produits: { rows: ProduitLigneRapport[]; total: number; isLoading: boolean };
  tri: string;
  sens: "asc" | "desc";
  onSort: (k: string) => void;
  page: number;
  onPage: (p: number) => void;
};

export function AnalyseZone(p: Props) {
  const [detail, setDetail] = useState<DetailTarget | null>(null);
  const { progress, exportProduits, exportDimension } = useAnalyseExport();
  const agDim = p.dim === "produits" ? null : p.dim;
  const aggQ = useQuery({
    queryKey: ["rap-agg", agDim, p.filters],
    queryFn: () => getRapportAgregat(p.filters, agDim ?? "niveau"),
    enabled: !!agDim,
    staleTime: 60_000,
  });
  const labelOf = p.dim === "ville" ? titleCaseVille : cleanSpaces;
  const dimName = DIMS.find(([d]) => d === p.dim)?.[1] ?? "";
  const count = agDim ? (aggQ.data?.length ?? 0) : p.produits.total;

  return (
    <section className="space-y-3" aria-labelledby="analyse-titre">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="analyse-titre" className="text-sm font-semibold">Analyser par</h2>
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={p.dim}
          onValueChange={(v) => v && p.onDim(v as AnalyseDim)}
          aria-label="Dimension d'analyse"
          className="flex-wrap justify-start"
        >
          {DIMS.map(([d, l]) => (
            <ToggleGroupItem key={d} value={d} className="h-9 px-3 text-sm">
              {l}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div className="ml-auto">
          <ExportMenu
            count={count}
            busy={!!progress}
            progress={progress ?? undefined}
            onExport={(kind) =>
              agDim
                ? exportDimension(kind, `Ventes par ${dimName.toLowerCase()}`, aggQ.data ?? [], labelOf, p.filters)
                : exportProduits(kind, p.filters, p.tri, p.sens)
            }
          />
        </div>
      </div>

      {agDim ? (
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="rounded-lg border bg-card lg:col-span-3">
            <DimensionTable
              rows={aggQ.data}
              isLoading={aggQ.isLoading}
              isError={aggQ.isError}
              labelOf={labelOf}
              onOpen={(row) => setDetail({ kind: "dim", dim: agDim, label: labelOf(row.label), row })}
              emptyAction={
                <Button variant="outline" size="sm" onClick={p.onClearFilters}>
                  Effacer les filtres
                </Button>
              }
            />
          </div>
          <div className="rounded-lg border bg-card p-3 lg:col-span-2">
            {aggQ.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (aggQ.data ?? []).length > 0 ? (
              <Suspense fallback={<Skeleton className="h-64 w-full" />}>
                <DimensionChart rows={aggQ.data ?? []} labelOf={labelOf} stacked={agDim === "categorie"} />
              </Suspense>
            ) : null}
          </div>
        </div>
      ) : (
        <ProduitsTab
          rows={p.produits.rows}
          total={p.produits.total}
          isLoading={p.produits.isLoading}
          tri={p.tri}
          sens={p.sens}
          onSort={p.onSort}
          page={p.page}
          onPage={p.onPage}
          onOpen={(row) => setDetail({ kind: "produit", row })}
        />
      )}

      <DetailSheet
        target={detail}
        filters={p.filters}
        onClose={() => setDetail(null)}
        onFilter={(t) => {
          setDetail(null);
          p.onFilter(t);
        }}
      />
    </section>
  );
}
