import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Wallet, FileText, CheckCircle2, Clock, Users, TrendingUp } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatFCFA } from "@/lib/format";
import { useExerciceConsulteId } from "@/contexts/ExerciceContext";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/paie-dashboard")({
  component: PaieDashboardPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function PaieDashboardPage() {
  const exerciceId = useExerciceConsulteId();
  const { data, isLoading } = useQuery({
    queryKey: ["paie-dashboard", exerciceId],
    enabled: !!exerciceId,
    queryFn: async () => {
      let query = supabase
        .from("bulletins_paie")
        .select("bulletin_id, salaire_brut, retenues, salaire_net, statut, periode");
      if (exerciceId) query = query.eq("exercice_id", exerciceId);
      const { data, error } = await query;
      if (error) throw error;
      const rows = data ?? [];
      const masse = rows.reduce((s, r) => s + Number(r.salaire_brut || 0), 0);
      const retenues = rows.reduce((s, r) => s + Number(r.retenues || 0), 0);
      const nets = rows.reduce((s, r) => s + Number(r.salaire_net || 0), 0);
      return {
        total: rows.length,
        valides: rows.filter((r) => r.statut === "valide" || r.statut === "paye").length,
        enAttente: rows.filter((r) => r.statut === "genere").length,
        masse,
        retenues,
        nets,
      };
    },
  });

  const kpis = [
    {
      label: "Bulletins générés",
      value: String(data?.total ?? 0),
      icon: FileText,
      color: "#3B82F6",
    },
    {
      label: "Bulletins validés",
      value: String(data?.valides ?? 0),
      icon: CheckCircle2,
      color: "#10B981",
    },
    { label: "En attente", value: String(data?.enAttente ?? 0), icon: Clock, color: "#F59E0B" },
    {
      label: "Masse salariale",
      value: formatFCFA(data?.masse ?? 0),
      icon: Wallet,
      color: "#8B5CF6",
    },
    {
      label: "Retenues cumulées",
      value: formatFCFA(data?.retenues ?? 0),
      icon: TrendingUp,
      color: "#EF4444",
    },
    {
      label: "Net total à payer",
      value: formatFCFA(data?.nets ?? 0),
      icon: Users,
      color: "#14B8A6",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="ds-page-title">Tableau de bord Paie</h1>
          <p className="text-sm text-muted-foreground">
            Vue d'ensemble des bulletins et de la masse salariale
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/paie">Bulletins</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/paie-parametres">Paramètres</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/paie-rubriques">Rubriques</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/paie-declarations">Déclarations</Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Chargement…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {kpis.map((k) => {
            const Icon = k.icon;
            return (
              <Card key={k.label}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {k.label}
                  </CardTitle>
                  <Icon className="h-5 w-5" style={{ color: k.color }} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" style={{ color: k.color }}>
                    {k.value}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
