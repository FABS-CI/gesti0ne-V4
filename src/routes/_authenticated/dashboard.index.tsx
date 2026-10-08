import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useRef, useState } from "react";
import { zodValidator } from "@tanstack/zod-adapter";
import { AlertTriangle, ArrowRight, Gauge, Inbox } from "lucide-react";

import { useExerciceConsulteId } from "@/contexts/ExerciceContext";
import { usePermissions } from "@/hooks/use-permissions";
import { useDashboardOverview } from "@/hooks/use-dashboard-overview";
import { periodeSchema, type Periode } from "@/lib/dashboard-helpers";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonKpiRow } from "@/components/ui/skeletons";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { WelcomeGreeting } from "@/components/dashboard/WelcomeGreeting";
import { DashboardKpis } from "@/components/dashboard/DashboardKpis";
import { DashboardChartsSection } from "@/components/dashboard/DashboardChartsSection";
import { MesRaccourcisCard } from "@/components/dashboard/MesRaccourcisCard";
import { DashboardQuickActions } from "@/components/dashboard/DashboardQuickActions";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

// Chargés à la demande : PDF/PNG export (html-to-image, jspdf) et sections
// non critiques du dashboard — ne pénalisent plus le TTI initial.
const DashboardModulesNav = lazy(() =>
  import("@/components/dashboard/DashboardModulesNav").then((m) => ({
    default: m.DashboardModulesNav,
  })),
);
const DashboardStockAlerts = lazy(() =>
  import("@/components/dashboard/DashboardStockAlerts").then((m) => ({
    default: m.DashboardStockAlerts,
  })),
);

export const Route = createFileRoute("/_authenticated/dashboard/")({
  validateSearch: zodValidator(periodeSchema),
  component: Dashboard,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function Dashboard() {
  const { periode } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const chartsRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState<null | "png" | "pdf">(null);
  const exerciceId = useExerciceConsulteId();
  const { has: hasPerm } = usePermissions();
  const canSeeCA = hasPerm("dashboard.voir_ca");

  const { data, isLoading, isError, refetch } = useDashboardOverview(periode, exerciceId);

  const onExportPng = async () => {
    setExporting("png");
    try {
      const { captureChartsNode, downloadDataUrl } = await import("@/lib/dashboard-export");
      const dataUrl = await captureChartsNode(chartsRef.current);
      if (dataUrl) downloadDataUrl(dataUrl, `tableau-de-bord-${periode}j.png`);
    } finally {
      setExporting(null);
    }
  };

  const onExportPdf = async () => {
    setExporting("pdf");
    try {
      const { captureChartsNode, exportDashboardPdf } = await import("@/lib/dashboard-export");
      const dataUrl = await captureChartsNode(chartsRef.current);
      if (dataUrl) await exportDashboardPdf(dataUrl, periode);
    } finally {
      setExporting(null);
    }
  };

  const onPeriode = (p: Periode) =>
    navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, periode: p }) });

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <div>
          <p className="font-semibold">Impossible de charger le tableau de bord</p>
          <p className="text-sm text-muted-foreground">
            Les chiffres du tableau de bord n'ont pas pu être chargés. Vérifiez votre connexion puis réessayez.
          </p>
        </div>
        <Button onClick={() => refetch()}>Réessayer</Button>
      </div>
    );
  }

  const hasData =
    (data?.clientsTotal ?? 0) > 0 ||
    (data?.nbCommandes ?? 0) > 0 ||
    (data?.recettes ?? 0) > 0 ||
    (data?.depenses ?? 0) > 0;

  const pilotage = (
    <div className="grid gap-4 lg:grid-cols-2">
      <Link
        to="/pilotage"
        className="flex items-center justify-between gap-3 rounded-md border bg-card px-4 py-2.5 text-sm transition-colors hover:bg-muted/60"
      >
        <span className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-muted-foreground" />
          <span>
            <span className="font-medium">Centre de pilotage</span>
            <span className="text-muted-foreground"> — ce qu'il faut traiter aujourd'hui</span>
          </span>
        </span>
        <ArrowRight className="h-4 w-4 text-primary" />
      </Link>
      <MesRaccourcisCard />
    </div>
  );

  return (
    <div className="theme-dashboard space-y-4 overflow-x-hidden bg-background text-foreground">
      <DashboardHeader
        periode={periode}
        onPeriode={onPeriode}
        hasData={hasData}
        exporting={exporting}
        onExportPng={onExportPng}
        onExportPdf={onExportPdf}
      />

      <WelcomeGreeting />

      <DashboardQuickActions />

      <div className="min-h-[400px]">
        {isLoading ? (
          <div className="space-y-6">
            <SkeletonKpiRow count={4} />
            <Skeleton className="h-72 w-full rounded-xl" />
            <div className="grid gap-4 lg:grid-cols-2">
              <Skeleton className="h-64 w-full rounded-xl" />
              <Skeleton className="h-64 w-full rounded-xl" />
            </div>
          </div>
        ) : !hasData ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-4 py-20 text-center">
              <Inbox className="h-10 w-10 text-muted-foreground" />
              <div>
                <p className="font-semibold">Aucune donnée à afficher</p>
                <p className="text-sm text-muted-foreground">
                  Aucune activité enregistrée sur les {periode} derniers jours. Créez votre première
                  commande pour voir vos indicateurs.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="outline" asChild>
                  <Link to="/commandes">Nouvelle commande</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/clients">Ajouter un client</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
        {!isLoading && !hasData ? <div className="mt-4">{pilotage}</div> : null}
        {!isLoading && hasData ? (
          <>
            <DashboardKpis data={data} canSeeCA={canSeeCA} />
            <div className="mt-4">{pilotage}</div>
            <DashboardChartsSection
              ref={chartsRef}
              data={data}
              canSeeCA={canSeeCA}
              periode={periode}
            />
            <Suspense fallback={<Skeleton className="h-40 w-full rounded-xl" />}>
              <DashboardModulesNav data={data} />
            </Suspense>
            <Suspense fallback={<Skeleton className="h-40 w-full rounded-xl" />}>
              <DashboardStockAlerts data={data} />
            </Suspense>
          </>
        ) : null}
      </div>
    </div>
  );
}
