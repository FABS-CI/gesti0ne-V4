import { formatDateTime } from "@/lib/format";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Database, Activity, Zap, RefreshCw, ExternalLink } from "lucide-react";
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
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/admin/slo")({
  component: SloPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

type SloMetrics = {
  errors_24h: number;
  alerts_open: number;
  db_size: string;
  active_connections: number;
  slow_queries: Array<{
    query: string;
    calls: number;
    mean_ms: number;
    total_ms: number;
  }>;
  generated_at: string;
};

type AlertRow = {
  id: string;
  source: string;
  severity: string;
  title: string;
  message: string | null;
  resolved: boolean;
  created_at: string;
};

function SloPage() {
  const metricsQ = useQuery({
    queryKey: ["slo-metrics"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_slo_metrics" as never);
      if (error) throw error;
      return data as unknown as SloMetrics;
    },
    refetchInterval: 30_000,
  });

  const alertsQ = useQuery({
    queryKey: ["incident-alerts-recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incident_alerts")
        .select("id, source, severity, title, message, resolved, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as AlertRow[];
    },
    refetchInterval: 30_000,
  });

  const m = metricsQ.data;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="ds-page-title">Dashboard SLO / Production</h1>
          <p className="text-sm text-muted-foreground">
            Indicateurs de santé temps réel — refresh auto 30 s
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="/docs/runbook-incidents.md" target="_blank" rel="noreferrer">
              <ExternalLink className="w-4 h-4 mr-2" />
              Runbook
            </a>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              metricsQ.refetch();
              alertsQ.refetch();
            }}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Rafraîchir
          </Button>
        </div>
      </div>

      {metricsQ.isError && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-sm text-destructive">
            Impossible de charger les métriques — accès super_admin requis.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          icon={<AlertTriangle className="w-4 h-4" />}
          label="Erreurs 24 h"
          value={m?.errors_24h ?? "—"}
          tone={m && m.errors_24h > 5 ? "danger" : "ok"}
        />
        <MetricCard
          icon={<AlertTriangle className="w-4 h-4" />}
          label="Alertes ouvertes"
          value={m?.alerts_open ?? "—"}
          tone={m && m.alerts_open > 0 ? "warn" : "ok"}
        />
        <MetricCard
          icon={<Database className="w-4 h-4" />}
          label="Taille DB"
          value={m?.db_size ?? "—"}
          tone="ok"
        />
        <MetricCard
          icon={<Activity className="w-4 h-4" />}
          label="Connexions actives"
          value={m?.active_connections ?? "—"}
          tone={m && m.active_connections > 40 ? "warn" : "ok"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" /> Top 10 requêtes lentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Requête</TableHead>
                <TableHead className="text-right">Appels</TableHead>
                <TableHead className="text-right">Moy. (ms)</TableHead>
                <TableHead className="text-right">Total (ms)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(m?.slow_queries ?? []).map((q, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-xs max-w-md truncate">{q.query}</TableCell>
                  <TableCell className="text-right">{q.calls}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={q.mean_ms > 500 ? "destructive" : "secondary"}>
                      {q.mean_ms}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{q.total_ms}</TableCell>
                </TableRow>
              ))}
              {(!m?.slow_queries || m.slow_queries.length === 0) && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Aucune donnée pg_stat_statements
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alertes d'incident récentes (20)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Sévérité</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Titre</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(alertsQ.data ?? []).map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="text-xs">
                    {formatDateTime(a.created_at)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        a.severity === "critical" || a.severity === "error"
                          ? "destructive"
                          : a.severity === "warning"
                            ? "default"
                            : "secondary"
                      }
                    >
                      {a.severity}
                    </Badge>
                  </TableCell>
                  <TableCell>{a.source}</TableCell>
                  <TableCell className="max-w-md truncate">{a.title}</TableCell>
                  <TableCell>
                    {a.resolved ? (
                      <Badge variant="outline">Résolu</Badge>
                    ) : (
                      <Badge variant="destructive">Ouvert</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(alertsQ.data?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Aucune alerte enregistrée
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {m?.generated_at && (
        <p className="text-xs text-muted-foreground text-right">
          Dernière mesure : {formatDateTime(m.generated_at)}
        </p>
      )}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tone: "ok" | "warn" | "danger";
}) {
  const toneClass =
    tone === "danger" ? "border-destructive" : tone === "warn" ? "border-warning" : "";
  return (
    <Card className={toneClass}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
          {icon} {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
