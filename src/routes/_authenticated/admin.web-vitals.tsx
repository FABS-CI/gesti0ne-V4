import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Gauge } from "lucide-react";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/admin/web-vitals")({
  component: WebVitalsPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

type Row = {
  metric: string;
  value: number;
  rating: string;
  route: string | null;
  created_at: string;
};

type Agg = {
  metric: string;
  count: number;
  p75: number;
  poor: number;
  needs: number;
  good: number;
};

const THRESHOLDS: Record<string, { good: number; poor: number; unit: string }> = {
  LCP: { good: 2500, poor: 4000, unit: "ms" },
  INP: { good: 200, poor: 500, unit: "ms" },
  CLS: { good: 0.1, poor: 0.25, unit: "" },
  TTFB: { good: 800, poor: 1800, unit: "ms" },
  FCP: { good: 1800, poor: 3000, unit: "ms" },
};

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p));
  return sorted[idx];
}

function WebVitalsPage() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["web-vitals", "recent"],
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("perf_web_vitals")
        .select("metric,value,rating,route,created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
    staleTime: 60_000,
  });

  const byMetric = new Map<string, number[]>();
  const ratings = new Map<string, { good: number; needs: number; poor: number }>();
  for (const r of rows) {
    if (!byMetric.has(r.metric)) byMetric.set(r.metric, []);
    byMetric.get(r.metric)!.push(r.value);
    const bucket = ratings.get(r.metric) ?? { good: 0, needs: 0, poor: 0 };
    if (r.rating === "good") bucket.good++;
    else if (r.rating === "poor") bucket.poor++;
    else bucket.needs++;
    ratings.set(r.metric, bucket);
  }
  const aggregates: Agg[] = Array.from(byMetric.entries()).map(([metric, values]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const r = ratings.get(metric)!;
    return {
      metric,
      count: values.length,
      p75: percentile(sorted, 0.75),
      good: r.good,
      needs: r.needs,
      poor: r.poor,
    };
  });

  // Top pages lentes (par route, sur LCP)
  const routeMap = new Map<string, number[]>();
  for (const r of rows) {
    if (r.metric !== "LCP" || !r.route) continue;
    if (!routeMap.has(r.route)) routeMap.set(r.route, []);
    routeMap.get(r.route)!.push(r.value);
  }
  const routes = Array.from(routeMap.entries())
    .map(([route, values]) => {
      const sorted = [...values].sort((a, b) => a - b);
      return { route, count: values.length, p75: percentile(sorted, 0.75) };
    })
    .filter((r) => r.count >= 5)
    .sort((a, b) => b.p75 - a.p75)
    .slice(0, 15);

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Gauge className="h-6 w-6 text-primary" />
        <h1 className="ds-page-title">Web Vitals — 7 derniers jours</h1>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Chargement…</p>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Aucune métrique collectée pour l'instant. Naviguez dans l'app pour
            générer des mesures.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {aggregates.map((a) => {
              const th = THRESHOLDS[a.metric];
              const p75 = a.metric === "CLS" ? a.p75.toFixed(3) : Math.round(a.p75);
              const status =
                a.p75 <= th.good ? "good" : a.p75 <= th.poor ? "needs" : "poor";
              const color =
                status === "good"
                  ? "text-success"
                  : status === "needs"
                    ? "text-warning"
                    : "text-destructive";
              return (
                <Card key={a.metric}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {a.metric}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    <div className={`text-2xl font-bold ${color}`}>
                      {p75}
                      {th.unit && <span className="text-sm ml-1">{th.unit}</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      p75 · {a.count} mesures
                    </div>
                    <div className="flex gap-1 pt-1">
                      <Badge variant="outline" className="text-success">
                        {a.good}
                      </Badge>
                      <Badge variant="outline" className="text-warning">
                        {a.needs}
                      </Badge>
                      <Badge variant="outline" className="text-destructive">
                        {a.poor}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {routes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-4 w-4" />
                  Pages les plus lentes (LCP p75)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {routes.map((r) => (
                    <div
                      key={r.route}
                      className="flex items-center justify-between border-b py-2 last:border-0"
                    >
                      <code className="text-sm">{r.route}</code>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">
                          {r.count} mesures
                        </span>
                        <Badge
                          variant={r.p75 > 4000 ? "destructive" : "outline"}
                          className="tabular-nums"
                        >
                          {Math.round(r.p75)} ms
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
