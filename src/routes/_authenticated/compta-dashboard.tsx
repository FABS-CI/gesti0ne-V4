import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Users,
  Truck,
  BookOpen,
  Scale,
  FileText,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getDashboardCompta } from "@/lib/compta-api";
import { formatFCFA } from "@/lib/format";
import { useExerciceConsulteId } from "@/contexts/ExerciceContext";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/compta-dashboard")({
  component: ComptaDashboard,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function ComptaDashboard() {
  const exerciceId = useExerciceConsulteId();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["compta-dashboard", from, to, exerciceId],
    queryFn: () => getDashboardCompta(from || undefined, to || undefined, exerciceId),
  });

  const kpis = [
    { label: "Produits (cl. 7)", value: data?.produits ?? 0, icon: TrendingUp, color: "#10B981" },
    { label: "Charges (cl. 6)", value: data?.charges ?? 0, icon: TrendingDown, color: "#EF4444" },
    {
      label: "Résultat",
      value: data?.resultat ?? 0,
      icon: Scale,
      color: (data?.resultat ?? 0) >= 0 ? "#10B981" : "#EF4444",
    },
    { label: "Trésorerie (cl. 5)", value: data?.tresorerie ?? 0, icon: Wallet, color: "#F97316" },
    {
      label: "Créances clients (411)",
      value: data?.creancesClients ?? 0,
      icon: Users,
      color: "#3B82F6",
    },
    {
      label: "Dettes fourn. (401)",
      value: data?.dettesFournisseurs ?? 0,
      icon: Truck,
      color: "#8B5CF6",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="ds-page-title">Tableau de bord comptable</h1>
          <p className="text-sm text-muted-foreground">Vue d'ensemble des comptes</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/comptabilite">
              <BookOpen className="mr-2 h-4 w-4" /> Journal
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/balance">
              <Scale className="mr-2 h-4 w-4" /> Balance
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/grand-livre">
              <FileText className="mr-2 h-4 w-4" /> Grand livre
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap gap-3 p-4">
          <div>
            <Label>Du</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>Au</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

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
                    {formatFCFA(k.value)}
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
