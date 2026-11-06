import { forwardRef, lazy, Suspense } from "react";
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { STATUT_COLORS, type Periode } from "@/lib/dashboard-helpers";
import type { DashboardOverview } from "@/hooks/use-dashboard-overview";

const CAAreaChart = lazy(() =>
  import("@/components/dashboard/DashboardCharts").then((m) => ({ default: m.CAAreaChart })),
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
        {canSeeCA && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Chiffre d'affaires (6 derniers mois)</CardTitle>
              <Link
                to="/commandes"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Détails
              </Link>
            </CardHeader>
            <CardContent className="h-72">
              <Suspense fallback={<Skeleton className="h-full w-full" />}>
                <CAAreaChart data={data?.caMensuel ?? []} />
              </Suspense>
            </CardContent>
          </Card>
        )}

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
