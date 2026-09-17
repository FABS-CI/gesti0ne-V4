import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Activity, RefreshCw, AlertTriangle } from "lucide-react";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/admin/perf")({
  component: PerfPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

type PerfRow = {
  id: string;
  query_key: string | null;
  route: string | null;
  duration_ms: number;
  status: string | null;
  error: string | null;
  created_at: string;
};

type Aggregate = {
  query_name: string;
  calls: number;
  avg_ms: number;
  max_ms: number;
  errors: number;
};

function PerfPage() {
  const {
    data: recent,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["perf-query-log-recent"],
    queryFn: async (): Promise<PerfRow[]> => {
      const { data, error } = await supabase
        .from("perf_query_log")
        .select("id, query_key, route, duration_ms, status, error, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as PerfRow[];
    },
    refetchInterval: 30_000,
  });

  const rows = recent ?? [];
  const aggregates: Aggregate[] = Object.values(
    rows.reduce<Record<string, Aggregate>>((acc, r) => {
      const key = r.query_key ?? "?";
      const cur = acc[key] ?? {
        query_name: key,
        calls: 0,
        avg_ms: 0,
        max_ms: 0,
        errors: 0,
      };
      cur.calls += 1;
      cur.avg_ms = (cur.avg_ms * (cur.calls - 1) + Number(r.duration_ms)) / cur.calls;
      cur.max_ms = Math.max(cur.max_ms, Number(r.duration_ms));
      if (r.error) cur.errors += 1;
      acc[key] = cur;
      return acc;
    }, {}),
  ).sort((a, b) => b.avg_ms - a.avg_ms);

  const slow = rows.filter((r) => Number(r.duration_ms) > 500);
  const errors = rows.filter((r) => r.error);

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <Activity className="h-8 w-8" /> Suivi performance requêtes
          </h1>
          <p className="text-muted-foreground">
            200 dernières requêtes critiques instrumentées via <code>trackQuery()</code>
          </p>
        </div>
        <Button onClick={() => refetch()} disabled={isFetching} variant="outline">
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Rafraîchir
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Requêtes tracées" value={rows.length} />
        <StatCard
          label="Lentes (>500ms)"
          value={slow.length}
          tone={slow.length > 0 ? "warn" : undefined}
        />
        <StatCard
          label="Erreurs"
          value={errors.length}
          tone={errors.length > 0 ? "error" : undefined}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Agrégat par requête</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Requête</TableHead>
                <TableHead className="text-right">Appels</TableHead>
                <TableHead className="text-right">Moy (ms)</TableHead>
                <TableHead className="text-right">Max (ms)</TableHead>
                <TableHead className="text-right">Erreurs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {aggregates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Aucune donnée. Instrumentez vos requêtes avec <code>trackQuery()</code>.
                  </TableCell>
                </TableRow>
              ) : (
                aggregates.map((a) => (
                  <TableRow key={a.query_name}>
                    <TableCell className="font-mono text-sm">{a.query_name}</TableCell>
                    <TableCell className="text-right">{a.calls}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={a.avg_ms > 500 ? "destructive" : "secondary"}>
                        {a.avg_ms.toFixed(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{a.max_ms.toFixed(1)}</TableCell>
                    <TableCell className="text-right">
                      {a.errors > 0 ? (
                        <Badge variant="destructive">{a.errors}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {errors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Erreurs récentes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {errors.slice(0, 20).map((e) => (
              <div
                key={e.id}
                className="rounded border border-destructive/40 bg-destructive/5 p-2 text-sm"
              >
                <div className="font-mono">{e.query_key ?? "—"}</div>
                <div className="text-muted-foreground text-xs">
                  {new Date(e.created_at).toLocaleString("fr-FR")} — {e.duration_ms}ms
                </div>
                <div className="text-destructive text-xs">{e.error}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "warn" | "error";
}) {
  const color =
    tone === "error" ? "text-destructive" : tone === "warn" ? "text-orange-500" : "text-foreground";
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-muted-foreground text-sm">{label}</div>
        <div className={`text-3xl font-bold ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
