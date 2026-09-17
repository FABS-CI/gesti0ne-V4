import { useEffect, useMemo, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const PERIODES = ["24h", "7j", "30j"] as const;
type Periode = (typeof PERIODES)[number];
const PERIODE_HOURS: Record<Periode, number> = { "24h": 24, "7j": 24 * 7, "30j": 24 * 30 };

const searchSchema = z.object({
  rpc: fallback(z.string(), "").default(""),
  user: fallback(z.string(), "").default(""),
  periode: fallback(z.enum(PERIODES), "7j").default("7j"),
  seuil: fallback(z.number().int().min(1).max(1000), 10).default(10),
});

export const Route = createFileRoute("/_authenticated/admin/rpc-errors")({
  validateSearch: zodValidator(searchSchema),
  component: RpcErrorsPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

type RpcErrorRow = {
  id: string;
  created_at: string;
  query_key: string | null;
  route: string | null;
  status: string | null;
  error: string | null;
  duration_ms: number | null;
  metadata: Record<string, unknown> | null;
};

function RpcErrorsPage() {
  const { rpc, user, periode, seuil } = Route.useSearch();
  const navigate = useNavigate({ from: "/admin/rpc-errors" });
  const alertedAtRef = useRef<number>(0);

  const { data, refetch, isFetching, error } = useQuery({
    queryKey: ["rpc-errors-recent", periode],
    queryFn: async (): Promise<RpcErrorRow[]> => {
      const since = new Date(
        Date.now() - PERIODE_HOURS[periode as Periode] * 3600_000,
      ).toISOString();
      // v_rpc_errors_recent : vue non typée dans supabase/types.ts
      const { data, error } = await (
        supabase as unknown as {
          from: (t: string) => {
            select: (s: string) => {
              gte: (
                c: string,
                v: string,
              ) => {
                order: (
                  c: string,
                  o: { ascending: boolean },
                ) => {
                  limit: (n: number) => Promise<{
                    data: RpcErrorRow[] | null;
                    error: { message: string } | null;
                  }>;
                };
              };
            };
          };
        }
      )
        .from("v_rpc_errors_recent")
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    refetchInterval: 30_000,
  });

  const allRows = data ?? [];
  const rows = useMemo(() => {
    const rpcNorm = rpc.trim().toLowerCase();
    const userNorm = user.trim().toLowerCase();
    return allRows.filter((r) => {
      if (rpcNorm && !(r.query_key ?? "").toLowerCase().includes(rpcNorm)) return false;
      if (userNorm && !(r.route ?? "").toLowerCase().includes(userNorm)) return false;
      return true;
    });
  }, [allRows, rpc, user]);

  // Alerte : seuil dépassé sur la période affichée (max 1 toast / 5 min)
  useEffect(() => {
    if (rows.length >= seuil && Date.now() - alertedAtRef.current > 5 * 60_000) {
      alertedAtRef.current = Date.now();
      toast.error(
        `! ${rows.length} échecs RPC sur ${periode} (seuil ${seuil}) — notification super_admin & directeur_général`,
        { duration: 10_000 },
      );
    }
  }, [rows.length, seuil, periode]);

  const byRpc = rows.reduce<Record<string, number>>((acc, r) => {
    const key = r.query_key ?? "?";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const topRpc = Object.entries(byRpc)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  type SearchState = { rpc: string; user: string; periode: Periode; seuil: number };
  const setSearch = (patch: Partial<SearchState>) =>
    navigate({
      search: (prev: SearchState) => ({ ...prev, ...patch }),
      replace: true,
    });

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <AlertTriangle className="h-7 w-7 text-destructive" />
            Erreurs RPC — 7 derniers jours
          </h1>
          <p className="text-sm text-muted-foreground">
            Journal des échecs de requêtes critiques instrumentées. Réservé aux
            super-admins.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="f-rpc" className="text-xs">
              RPC / table
            </Label>
            <Input
              id="f-rpc"
              placeholder="ex. creer_commande"
              value={rpc}
              onChange={(e) => setSearch({ rpc: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="f-user" className="text-xs">
              Route
            </Label>
            <Input
              id="f-user"
              placeholder="ex. /commandes"
              value={user}
              onChange={(e) => setSearch({ user: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Période</Label>
            <Select value={periode} onValueChange={(v) => setSearch({ periode: v as Periode })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="f-seuil" className="text-xs">
              Seuil alerte
            </Label>
            <Input
              id="f-seuil"
              type="number"
              min={1}
              value={seuil}
              onChange={(e) => setSearch({ seuil: Math.max(1, Number(e.target.value) || 1) })}
            />
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4 text-sm text-destructive">
            {(error as Error).message} — accès réservé aux rôles super_admin / directeur_general.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Total ({periode}) {rows.length >= seuil && "🚨"}
            </CardTitle>
          </CardHeader>
          <CardContent
            className={`text-3xl font-bold ${rows.length >= seuil ? "text-destructive" : ""}`}
          >
            {rows.length}
          </CardContent>
        </Card>
        {topRpc.map(([name, count]) => (
          <Card key={name}>
            <CardHeader className="pb-2">
              <CardTitle className="truncate text-sm text-muted-foreground">{name}</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold text-destructive">{count}</CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dernières erreurs</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune erreur enregistrée ✅</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quand</TableHead>
                  <TableHead>RPC / table</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Durée</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {new Date(r.created_at).toLocaleString("fr-FR")}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.query_key ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{r.route ?? r.status ?? "—"}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.duration_ms != null ? `${r.duration_ms} ms` : "—"}
                    </TableCell>
                    <TableCell
                      className="max-w-md truncate text-xs text-destructive"
                      title={r.error ?? ""}
                    >
                      {r.error ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
