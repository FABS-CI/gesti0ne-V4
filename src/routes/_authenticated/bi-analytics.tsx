import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import { lazy, Suspense } from "react";

import { supabase } from "@/integrations/supabase/client";
import { formatFCFA } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

const CashflowChart = lazy(() =>
  import("@/components/bi/BiCharts").then((m) => ({ default: m.CashflowChart })),
);
const StatutPieChart = lazy(() =>
  import("@/components/bi/BiCharts").then((m) => ({ default: m.StatutPieChart })),
);
const TopProduitsChart = lazy(() =>
  import("@/components/bi/BiCharts").then((m) => ({ default: m.TopProduitsChart })),
);

const ChartFallback = () => <Skeleton className="h-full w-full" />;

export const Route = createFileRoute("/_authenticated/bi-analytics")({
  component: BiAnalytics,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

const MONTHS = [
  "Jan",
  "Fév",
  "Mar",
  "Avr",
  "Mai",
  "Juin",
  "Juil",
  "Août",
  "Sep",
  "Oct",
  "Nov",
  "Déc",
];

function BiAnalytics() {
  const { data, isError, refetch } = useQuery({
    queryKey: ["bi-analytics"],
    queryFn: async () => {
      const year = new Date().getFullYear();
      const [transactions, commandes, produits] = await Promise.all([
        supabase
          .from("transactions")
          .select("type, montant, date_transaction, statut")
          .gte("date_transaction", `${year}-01-01`)
          .lte("date_transaction", `${year}-12-31`),
        supabase.from("commandes").select("statut, montant_total"),
        supabase.from("v_produits").select("titre, prix_vente, stock").eq("actif", true),
      ]);
      for (const r of [transactions, commandes, produits]) {
        if (r.error) throw r.error;
      }

      type Trx = {
        statut: string | null;
        date_transaction: string;
        type: string;
        montant: number | null;
      };
      type Cmd = { statut: string | null };
      type Prd = { titre: string | null; prix_vente: number | null; stock: number | null };

      const monthly: Record<number, { recettes: number; depenses: number }> = {};
      for (let i = 0; i < 12; i++) monthly[i] = { recettes: 0, depenses: 0 };
      for (const t of (transactions.data ?? []) as Trx[]) {
        if (t.statut === "annule") continue;
        const d = new Date(t.date_transaction);
        if (d.getFullYear() !== year) continue;
        const m = d.getMonth();
        if (t.type === "recette") monthly[m].recettes += Number(t.montant);
        else monthly[m].depenses += Number(t.montant);
      }
      const cashflow = MONTHS.map((label, i) => ({
        mois: label,
        recettes: monthly[i].recettes,
        depenses: monthly[i].depenses,
      }));

      const statutMap: Record<string, number> = {};
      for (const c of (commandes.data ?? []) as Cmd[]) {
        const k = c.statut ?? "—";
        statutMap[k] = (statutMap[k] ?? 0) + 1;
      }
      const commandesParStatut = Object.entries(statutMap).map(([name, value]) => ({
        name,
        value,
      }));

      const prds = ((produits.data ?? []) as Prd[]).map((p) => ({
        titre: p.titre ?? "",
        valeur: Math.max(0, Number(p.stock || 0)) * Number(p.prix_vente || 0),
      }));

      const topProduits = prds
        .sort((a, b) => b.valeur - a.valeur)
        .slice(0, 8);

      const totalRecettes = cashflow.reduce((s, m) => s + m.recettes, 0);
      const totalDepenses = cashflow.reduce((s, m) => s + m.depenses, 0);
      const valeurStock = prds.reduce((s, p) => s + p.valeur, 0);

      return {
        cashflow,
        commandesParStatut,
        topProduits,
        totalRecettes,
        totalDepenses,
        valeurStock,
      };
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <BarChart3 className="h-6 w-6 text-primary" /> Business Intelligence
        </h1>
        <p className="text-sm text-muted-foreground">Analyses et tendances de l'activité</p>
      </div>

      {isError && (
        <Card className="border-destructive">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <p className="text-sm text-destructive">
              Impossible de charger les analyses. Les montants ci-dessous ne sont pas fiables.
            </p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>Réessayer</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Recettes (année)</p>
            <p className="text-xl font-bold text-emerald-600">
              {formatFCFA(data?.totalRecettes ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Dépenses (année)</p>
            <p className="text-xl font-bold text-red-600">{formatFCFA(data?.totalDepenses ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Valeur du stock</p>
            <p className="text-xl font-bold">{formatFCFA(data?.valeurStock ?? 0)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trésorerie mensuelle</CardTitle>
        </CardHeader>
        <CardContent className="h-80">
          <Suspense fallback={<ChartFallback />}>
            <CashflowChart data={data?.cashflow ?? []} />
          </Suspense>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Commandes par statut</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <Suspense fallback={<ChartFallback />}>
              <StatutPieChart data={data?.commandesParStatut ?? []} />
            </Suspense>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top produits (valeur en stock)</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <Suspense fallback={<ChartFallback />}>
              <TopProduitsChart data={data?.topProduits ?? []} />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
