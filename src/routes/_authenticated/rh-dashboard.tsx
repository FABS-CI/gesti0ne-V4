import { createFileRoute, Link } from "@tanstack/react-router";
import { formatFCFA } from "@/lib/format";

import { useQuery } from "@tanstack/react-query";
import {
  Users,
  UserCheck,
  Wallet,
  CalendarDays,
  UserX,
  FileWarning,
  ArrowRight,
  AlertCircle,
  Building2,
  Plane,
} from "lucide-react";
import { lazy, Suspense } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getRHDashboard } from "@/lib/rh-api";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

const EffectifChart = lazy(() => import("@/components/rh/EffectifChart"));

export const Route = createFileRoute("/_authenticated/rh-dashboard")({
  component: RHDashboardPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

const SEVERITE_STYLE: Record<string, string> = {
  info: "border-l-4 border-l-blue-500 bg-blue-500/5",
  warning: "border-l-4 border-l-orange-500 bg-orange-500/5",
  danger: "border-l-4 border-l-red-500 bg-red-500/5",
};

function RHDashboardPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["rh-dashboard"],
    queryFn: getRHDashboard,
  });

  if (isLoading) {
    return <div className="p-8 text-muted-foreground">Chargement du tableau de bord RH…</div>;
  }
  if (isError || !data) {
    return <div className="p-8 text-destructive">Impossible de charger les données RH.</div>;
  }

  const kpis = [
    {
      label: "Employés",
      value: data.totalEmployes,
      icon: Users,
      color: "#8B5CF6",
      to: "/employes" as const,
    },
    {
      label: "Actifs",
      value: data.employesActifs,
      icon: UserCheck,
      color: "#10B981",
      to: "/employes" as const,
    },
    {
      label: "Masse salariale",
      value: formatFCFA(data.masseSalariale),
      icon: Wallet,
      color: "#F97316",
      to: "/paie" as const,
    },
    {
      label: "Congés en attente",
      value: data.congesEnAttente,
      icon: CalendarDays,
      color: "#3B82F6",
      to: "/conges" as const,
    },
    {
      label: "Employés en congé",
      value: data.employesEnConge,
      icon: Plane,
      color: "#0EA5E9",
      to: "/conges-en-cours" as const,
    },
    {
      label: "Absences en cours",
      value: data.absencesEnCours,
      icon: UserX,
      color: "#EF4444",
      to: "/absences" as const,
    },
    {
      label: "Contrats à échéance (30j)",
      value: data.contratsExpirantBientot,
      icon: FileWarning,
      color: "#F59E0B",
      to: "/contrats" as const,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="ds-page-title">Tableau de bord RH</h1>
          <p className="text-sm text-muted-foreground">Vue d'ensemble des ressources humaines</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/employes">
              <Users className="mr-2 h-4 w-4" /> Employés
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/paie">
              <Wallet className="mr-2 h-4 w-4" /> Paie
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((k) => {
          const Icon = k.icon;
          const card = (
            <Card
              key={k.label}
              className={
                "to" in k && k.to
                  ? "cursor-pointer transition hover:border-primary/50 hover:shadow-md"
                  : ""
              }
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {k.label}
                </CardTitle>
                <Icon className="h-5 w-5" style={{ color: k.color }} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{k.value}</div>
              </CardContent>
            </Card>
          );
          if ("to" in k && k.to) {
            return (
              <Link key={k.label} to={k.to} className="block">
                {card}
              </Link>
            );
          }
          return card;
        })}
      </div>

      {data.alertes.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="h-5 w-5 text-orange-500" /> Alertes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.alertes.map((a, i) => (
              <div key={i} className={`rounded-md p-3 text-sm ${SEVERITE_STYLE[a.severite]}`}>
                {a.message}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-5 w-5 text-violet-500" /> Effectif par département
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.effectifParDepartement.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun employé actif.</p>
            ) : (
              <Suspense fallback={<Skeleton className="h-[280px] w-full" />}>
                <EffectifChart data={data.effectifParDepartement} />
              </Suspense>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Accès rapides</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {[
              { to: "/employes", label: "Employés", icon: Users },
              { to: "/conges", label: "Congés", icon: CalendarDays },
              { to: "/absences", label: "Absences", icon: UserX },
              { to: "/contrats", label: "Contrats", icon: FileWarning },
              { to: "/evaluations", label: "Évaluations", icon: UserCheck },
              { to: "/paie", label: "Paie", icon: Wallet },
            ].map((l) => {
              const Icon = l.icon;
              return (
                <Button key={l.to} variant="outline" className="justify-between" asChild>
                  <Link to={l.to}>
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4" /> {l.label}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
