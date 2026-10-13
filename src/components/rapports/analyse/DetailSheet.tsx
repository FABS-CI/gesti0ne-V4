import { lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getRapportClientsProduit,
  getRapportEvolution,
  getRapportTopProduits,
  type AgregatDim,
  type ProduitLigneRapport,
  type RapportFilters,
} from "@/lib/rapports-api";
import { DIM_FILTER_KEY } from "@/lib/rapports-search";
import { formatFCFA, formatNumber } from "@/lib/format";

const EvolutionChart = lazy(() => import("./EvolutionChart"));

export type DetailTarget =
  | { kind: "produit"; row: ProduitLigneRapport }
  | { kind: "dim"; dim: keyof typeof DIM_FILTER_KEY; label: string; row: AgregatDim };

const DIM_NAMES = { niveau: "Niveau", categorie: "Catégorie", ville: "Ville", type: "Type de client" };

export function DetailSheet({
  target,
  filters,
  onClose,
  onFilter,
}: {
  target: DetailTarget | null;
  filters: RapportFilters;
  onClose: () => void;
  onFilter: (t: DetailTarget) => void;
}) {
  const scoped: RapportFilters = !target
    ? filters
    : target.kind === "produit"
      ? { ...filters, produits: [target.row.produit_id] }
      : { ...filters, [DIM_FILTER_KEY[target.dim]]: [target.row.label] };

  const evoQ = useQuery({
    queryKey: ["rap-detail-evo", scoped],
    queryFn: () => getRapportEvolution(scoped, "mois"),
    enabled: !!target,
    staleTime: 60_000,
  });
  const clientsQ = useQuery({
    queryKey: ["rap-detail-clients", target?.kind === "produit" ? target.row.produit_id : null, filters],
    queryFn: () =>
      getRapportClientsProduit((target as { row: ProduitLigneRapport }).row.produit_id, filters, 5),
    enabled: target?.kind === "produit",
    staleTime: 60_000,
  });
  const liesFilters: RapportFilters =
    target?.kind === "produit"
      ? { ...filters, niveaux: target.row.niveau ? [target.row.niveau] : filters.niveaux }
      : scoped;
  const liesQ = useQuery({
    queryKey: ["rap-detail-lies", liesFilters],
    queryFn: () => getRapportTopProduits(liesFilters, 6),
    enabled: !!target,
    staleTime: 60_000,
  });

  const title = !target ? "" : target.kind === "produit" ? target.row.titre : target.label;
  const subtitle = !target
    ? ""
    : target.kind === "produit"
      ? [target.row.code, target.row.niveau].filter(Boolean).join(" · ")
      : DIM_NAMES[target.dim];
  const r = target?.row;
  const stats: [string, string][] = r
    ? [
        ["CA", formatFCFA(r.ca)],
        ["Quantité", formatNumber("qte_vendue" in r ? r.qte_vendue : r.qte)],
        ["Clients", formatNumber(r.nb_clients)],
        ["Factures", formatNumber(r.nb_factures)],
      ]
    : [];
  const lies = (liesQ.data ?? [])
    .filter((p) => target?.kind !== "produit" || p.produit_id !== target.row.produit_id)
    .slice(0, 5);

  return (
    <Sheet open={!!target} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="text-left">
          <SheetTitle className="text-base">{title}</SheetTitle>
          <SheetDescription>{subtitle}</SheetDescription>
        </SheetHeader>
        <dl className="mt-4 grid grid-cols-2 divide-x divide-y rounded-lg border tabular-nums">
          {stats.map(([l, v]) => (
            <div key={l} className="p-3">
              <dt className="text-xs text-muted-foreground">{l}</dt>
              <dd className="mt-0.5 font-semibold">{v}</dd>
            </div>
          ))}
        </dl>

        <h3 className="mb-1 mt-5 text-sm font-semibold">Évolution mensuelle</h3>
        {evoQ.isLoading ? (
          <Skeleton className="h-36 w-full" />
        ) : (
          <Suspense fallback={<Skeleton className="h-36 w-full" />}>
            <EvolutionChart data={evoQ.data ?? []} height={150} />
          </Suspense>
        )}

        {target?.kind === "produit" && (
          <>
            <h3 className="mb-1 mt-5 text-sm font-semibold">Meilleurs clients</h3>
            <ShortList
              loading={clientsQ.isLoading}
              items={(clientsQ.data ?? []).map((c) => [c.client_nom, formatFCFA(c.ca)])}
            />
          </>
        )}

        <h3 className="mb-1 mt-5 text-sm font-semibold">
          {target?.kind === "produit" ? "Produits du même niveau" : "Produits les plus vendus"}
        </h3>
        <ShortList loading={liesQ.isLoading} items={lies.map((p) => [p.titre, formatFCFA(p.ca)])} />

        {target && (
          <Button className="mt-6 w-full" onClick={() => onFilter(target)}>
            Filtrer sur cette valeur
          </Button>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ShortList({ loading, items }: { loading: boolean; items: [string, string][] }) {
  if (loading) return <Skeleton className="h-24 w-full" />;
  if (!items.length) return <p className="text-sm text-muted-foreground">Aucune donnée sur cette période.</p>;
  return (
    <ul className="divide-y rounded-lg border text-sm">
      {items.map(([l, v], i) => (
        <li key={l + i} className="flex items-center gap-2 px-3 py-2 tabular-nums">
          <span className="truncate">{l}</span>
          <span className="ml-auto whitespace-nowrap text-muted-foreground">{v}</span>
        </li>
      ))}
    </ul>
  );
}
