import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { SerieTemp } from "@/lib/rapports-api";

const EvolutionChart = lazy(() => import("./EvolutionChart"));

export type Granularite = "jour" | "semaine" | "mois" | "annee";
const OPTIONS: [Granularite, string][] = [
  ["jour", "Jour"],
  ["semaine", "Semaine"],
  ["mois", "Mois"],
  ["annee", "Année"],
];

export function EvolutionCard({
  data,
  previous,
  isLoading,
  isError,
  granularite,
  onGranularite,
}: {
  data: SerieTemp[] | undefined;
  previous?: SerieTemp[];
  isLoading: boolean;
  isError: boolean;
  granularite: Granularite;
  onGranularite: (g: Granularite) => void;
}) {
  const empty = !isLoading && !isError && (data ?? []).every((d) => !Number(d.ca));
  return (
    <section className="rounded-lg border bg-card" aria-labelledby="evolution-titre">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <h2 id="evolution-titre" className="text-sm font-semibold">
          Évolution du chiffre d'affaires
          {previous && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              pointillé : période précédente
            </span>
          )}
        </h2>
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={granularite}
          onValueChange={(v) => v && onGranularite(v as Granularite)}
          aria-label="Granularité"
        >
          {OPTIONS.map(([v, l]) => (
            <ToggleGroupItem key={v} value={v} className="h-8 px-3 text-xs">
              {l}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <div className="p-2">
        {isLoading ? (
          <Skeleton className="h-[260px] w-full" />
        ) : isError ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Le graphique n'a pas pu être chargé. Réessayez ou contactez l'administrateur.
          </p>
        ) : empty ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Aucune vente sur cette période pour les filtres choisis.
          </p>
        ) : (
          <Suspense fallback={<Skeleton className="h-[260px] w-full" />}>
            <EvolutionChart data={data ?? []} previous={previous} />
          </Suspense>
        )}
      </div>
    </section>
  );
}
