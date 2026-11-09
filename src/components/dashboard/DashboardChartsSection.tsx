import { forwardRef, lazy, Suspense } from "react";
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatFCFA } from "@/lib/format";
import { cn } from "@/lib/utils";
import { STATUT_COLORS, type Periode } from "@/lib/dashboard-helpers";
import type { DashboardOverview } from "@/hooks/use-dashboard-overview";

const CAAreaChart = lazy(() =>
  import("@/components/dashboard/DashboardCharts").then((m) => ({ default: m.CAAreaChart })),
);
const CABarChart = lazy(() =>
  import("@/components/dashboard/DashboardCharts").then((m) => ({ default: m.CABarChart })),
);
const CommandesBarChart = lazy(() =>
  import("@/components/dashboard/DashboardCharts").then((m) => ({ default: m.CommandesBarChart })),
);
const StatutPieChart = lazy(() =>
  import("@/components/dashboard/DashboardCharts").then((m) => ({ default: m.StatutPieChart })),
);

interface Props {
  data: DashboardOverview | undefined;
  canSeeCA: boolean;
  periode: Periode;
}

export const DashboardChartsSection = forwardRef<HTMLDivElement, Props>(
  function DashboardChartsSection({ data, canSeeCA, periode }, ref) {
    return (
      <div ref={ref} className="dash-stagger space-y-4">
        <div className="grid gap-4 lg:grid-cols-3">
          {canSeeCA && (
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <CardTitle className="text-base">Chiffre d'affaires (6 derniers mois)</CardTitle>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span aria-hidden className="h-2 w-2 rounded-sm bg-primary" /> Facturé
                </span>
              </CardHeader>
              <CardContent className="h-72">
                <Suspense fallback={<Skeleton className="h-full w-full" />}>
                  <CABarChart data={data?.caMensuel ?? []} />
                </Suspense>
              </CardContent>
            </Card>
          )}
          <ATraiterCard data={data} canSeeCA={canSeeCA} className={canSeeCA ? "" : "lg:col-span-3"} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Commandes par mois</CardTitle>
              <Link
                to="/commandes"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Détails
              </Link>
            </CardHeader>
            <CardContent className="h-64">
              <Suspense fallback={<Skeleton className="h-full w-full" />}>
                <CommandesBarChart data={data?.caMensuel ?? []} />
              </Suspense>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Commandes par statut</CardTitle>
              <Link
                to="/commandes"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Détails
              </Link>
            </CardHeader>
            <CardContent className="h-64">
              {(data?.parStatut.length ?? 0) === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                  <p>Aucune commande sur les {periode} derniers jours</p>
                  <Link to="/commandes" className="text-primary hover:underline">
                    Créer une commande
                  </Link>
                </div>
              ) : (
                <Suspense fallback={<Skeleton className="h-full w-full" />}>
                  <StatutPieChart data={data?.parStatut ?? []} colors={STATUT_COLORS} />
                </Suspense>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  },
);

type ATraiterTo = "/factures" | "/produits/alertes";

/** Une ligne par alerte présente dans les données du tableau de bord. */
function ATraiterCard({
  data,
  canSeeCA,
  className,
}: {
  data: DashboardOverview | undefined;
  canSeeCA: boolean;
  className?: string;
}) {
  const rows: { label: string; n: number; to: ATraiterTo; dot: string; sub?: string }[] = [
    {
      label: "Factures en retard",
      n: data?.nbRetards ?? 0,
      to: "/factures",
      dot: "bg-danger-soft-foreground",
      sub: canSeeCA && (data?.nbRetards ?? 0) > 0 ? formatFCFA(data?.montantRetard ?? 0) : undefined,
    },
    {
      label: "Produits sous le seuil",
      n: data?.nbStockBas ?? 0,
      to: "/produits/alertes",
      dot: "bg-warning-soft-foreground",
    },
  ];
  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader>
        <CardTitle className="text-base">À traiter</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.label}>
              <Link
                to={r.to}
                className="flex items-center gap-3 rounded-md py-3 text-sm transition-colors hover:bg-surface-subtle"
              >
                <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", r.n > 0 ? r.dot : "bg-muted-foreground/40")} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{r.label}</span>
                  {r.sub ? <span className="block text-xs text-muted-foreground">{r.sub}</span> : null}
                </span>
                <span className="font-semibold tabular-nums">{r.n}</span>
              </Link>
            </li>
          ))}
        </ul>
        <Link to="/pilotage" className="mt-2 inline-block text-sm text-primary hover:underline">
          Centre de pilotage
        </Link>
      </CardContent>
    </Card>
  );
}
