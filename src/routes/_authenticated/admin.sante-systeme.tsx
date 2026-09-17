import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRoles } from "@/hooks/use-user-roles";
import { audit } from "@/lib/audit-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Activity, RefreshCw, AlertTriangle, CheckCircle2, XCircle, AlertCircle,
  Users, Database, HardDrive, Shield, ServerCog, FileText, PlayCircle,
} from "lucide-react";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/admin/sante-systeme")({
  component: SanteSystemePage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

const REFRESH_MS = 30_000;
const STALE_MS = 25_000;

type ServiceStatus = "online" | "degraded" | "offline" | "unknown";

function SanteSystemePage() {
  const { isSuperAdmin, isLoading: rolesLoading } = useUserRoles();
  const qc = useQueryClient();
  const [testing, setTesting] = useState(false);
  // Compteur d'échecs consécutifs par service — alerte au 2ème échec d'affilée
  const failCounts = useRef<Record<string, number>>({});
  const alertedFor = useRef<Record<string, string>>({}); // key -> incident_alerts.id

  // ===== KPIs base (counts en head:true pour perf) =====
  const kpis = useQuery({
    queryKey: ["sh-kpis"],
    enabled: isSuperAdmin,
    refetchInterval: REFRESH_MS,
    staleTime: STALE_MS,
    queryFn: async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const startIso = start.toISOString();
      const last24 = new Date(Date.now() - 24 * 3600_000).toISOString();

      const c = (t: string, filter?: (q: any) => any) => {
        let q: any = supabase.from(t as any).select("*", { count: "exact", head: true });
        if (filter) q = filter(q);
        return q;
      };
      const [
        clients, produits, commandes, factures, paiements, mvtStock,
        opsToday, errorsToday, cmdToday, factToday, payToday, mvtToday,
        loginFailed24, connectionsToday,
      ] = await Promise.all([
        c("clients"),
        c("produits"),
        c("commandes"),
        c("factures"),
        c("paiements"),
        c("stock_mouvements"),
        c("audit_events", (q) => q.gte("occurred_at", startIso)),
        c("audit_events", (q) => q.gte("occurred_at", startIso).eq("status", "error")),
        c("commandes", (q) => q.gte("created_at", startIso)),
        c("factures", (q) => q.gte("created_at", startIso)),
        c("paiements", (q) => q.gte("created_at", startIso)),
        c("stock_mouvements", (q) => q.gte("created_at", startIso)),
        c("login_history", (q) => q.gte("created_at", last24).eq("success", false)),
        c("login_history", (q) => q.gte("created_at", startIso).eq("success", true)),
      ]);
      return {
        clients: clients.count ?? 0,
        produits: produits.count ?? 0,
        commandes: commandes.count ?? 0,
        factures: factures.count ?? 0,
        paiements: paiements.count ?? 0,
        mouvementsStock: mvtStock.count ?? 0,
        opsToday: opsToday.count ?? 0,
        errorsToday: errorsToday.count ?? 0,
        cmdToday: cmdToday.count ?? 0,
        factToday: factToday.count ?? 0,
        payToday: payToday.count ?? 0,
        mvtToday: mvtToday.count ?? 0,
        loginFailed24: loginFailed24.count ?? 0,
        connectionsToday: connectionsToday.count ?? 0,
      };
    },
  });

  // ===== Dernières erreurs =====
  const errors = useQuery({
    queryKey: ["sh-errors"],
    enabled: isSuperAdmin,
    refetchInterval: REFRESH_MS,
    staleTime: STALE_MS,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_events")
        .select("id, occurred_at, module, action, user_email, error_message, criticite")
        .eq("status", "error")
        .order("occurred_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  // ===== Dernières connexions =====
  const lastLogins = useQuery({
    queryKey: ["sh-logins"],
    enabled: isSuperAdmin,
    refetchInterval: REFRESH_MS,
    staleTime: STALE_MS,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("login_history")
        .select("id, created_at, success, user_id, email, ip")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

  // ===== Backups =====
  const backups = useQuery({
    queryKey: ["sh-backups"],
    enabled: isSuperAdmin,
    refetchInterval: REFRESH_MS,
    staleTime: STALE_MS,
    queryFn: async () => {
      const { data } = await supabase
        .from("backups")
        .select("backup_id, created_at, taille_octets, statut, duree_ms")
        .order("created_at", { ascending: false })
        .limit(5);
      const { data: sched } = await supabase
        .from("backup_schedules")
        .select("schedule_id, next_run_at, frequence, active")
        .eq("active", true)
        .order("next_run_at", { ascending: true })
        .limit(1);
      return { list: data ?? [], next: sched?.[0] ?? null };
    },
  });

  // ===== Services (pings) =====
  const services = useQuery({
    queryKey: ["sh-services"],
    enabled: isSuperAdmin,
    refetchInterval: REFRESH_MS,
    staleTime: STALE_MS,
    queryFn: async () => {
      const now = Date.now();
      const time = async <T,>(fn: () => Promise<T>): Promise<{ ok: boolean; ms: number }> => {
        const s = performance.now();
        try { await fn(); return { ok: true, ms: Math.round(performance.now() - s) }; }
        catch { return { ok: false, ms: Math.round(performance.now() - s) }; }
      };
      const [db, auth, storage, fne] = await Promise.all([
        time(async () => {
          const { error } = await supabase.from("clients").select("client_id", { head: true, count: "exact" }).limit(1);
          if (error) throw error;
        }),
        time(async () => {
          const { data, error } = await supabase.auth.getUser();
          if (error || !data.user) throw new Error("no user");
        }),
        time(async () => {
          const { error } = await supabase.storage.listBuckets();
          if (error) throw error;
        }),
        time(async () => {
          const { error } = await supabase.from("fne_settings").select("setting_id", { head: true, count: "exact" }).limit(1);
          if (error) throw error;
        }),
      ]);
      // Notifications & impression: dérivé des erreurs récentes
      const last5 = new Date(now - 5 * 60_000).toISOString();
      const [notifErr, printErr, waErr, mailErr] = await Promise.all([
        supabase.from("audit_events").select("*", { count: "exact", head: true }).eq("status", "error").eq("module", "notifications").gte("occurred_at", last5),
        supabase.from("audit_events").select("*", { count: "exact", head: true }).eq("status", "error").eq("module", "impression").gte("occurred_at", last5),
        supabase.from("audit_events").select("*", { count: "exact", head: true }).eq("status", "error").eq("module", "whatsapp").gte("occurred_at", last5),
        supabase.from("audit_events").select("*", { count: "exact", head: true }).eq("status", "error").eq("module", "email").gte("occurred_at", last5),
      ]);
      const dyn = (n: number | null): ServiceStatus => (n && n > 0 ? "degraded" : "online");
      return {
        list: [
          { key: "db", label: "Base de données", status: db.ok ? "online" : "offline", ms: db.ms },
          { key: "auth", label: "Authentification", status: auth.ok ? "online" : "offline", ms: auth.ms },
          { key: "storage", label: "Serveur de fichiers", status: storage.ok ? "online" : "offline", ms: storage.ms },
          { key: "fne", label: "FNE (facturation)", status: fne.ok ? "online" : "offline", ms: fne.ms },
          { key: "notifications", label: "Notifications", status: dyn(notifErr.count) },
          { key: "impression", label: "Impression PDF", status: dyn(printErr.count) },
          { key: "whatsapp", label: "WhatsApp", status: dyn(waErr.count) },
          { key: "email", label: "Emails", status: dyn(mailErr.count) },
        ] as { key: string; label: string; status: ServiceStatus; ms?: number }[],
        checkedAt: new Date(),
      };
    },
  });

  // ===== Intégrité =====
  const integrity = useQuery({
    queryKey: ["sh-integrity"],
    enabled: isSuperAdmin,
    refetchInterval: 60_000,
    staleTime: 55_000,
    queryFn: async () => {
      const negativeStock = await supabase
        .from("stocks_depots")
        .select("*", { count: "exact", head: true })
        .lt("quantite", 0);
      return {
        stocksNegatifs: negativeStock.count ?? 0,
      };
    },
  });

  // ===== Alertes =====
  const alerts = useQuery({
    queryKey: ["sh-alerts"],
    enabled: isSuperAdmin,
    refetchInterval: REFRESH_MS,
    staleTime: STALE_MS,
    queryFn: async () => {
      const { data } = await supabase
        .from("incident_alerts")
        .select("id, created_at, title, severity, message")
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  // ===== Perf requêtes DB (moyennes) =====
  const perf = useQuery({
    queryKey: ["sh-perf"],
    enabled: isSuperAdmin,
    refetchInterval: REFRESH_MS,
    staleTime: STALE_MS,
    queryFn: async () => {
      const { data } = await supabase
        .from("perf_query_log")
        .select("duration_ms, error")
        .order("created_at", { ascending: false })
        .limit(200);
      const rows = data ?? [];
      if (rows.length === 0) return { avg: 0, max: 0, errors: 0, count: 0 };
      const avg = rows.reduce((a, r) => a + Number(r.duration_ms), 0) / rows.length;
      const max = Math.max(...rows.map((r) => Number(r.duration_ms)));
      const errs = rows.filter((r) => r.error).length;
      return { avg, max, errors: errs, count: rows.length };
    },
  });

  // ===== Alerte auto (2 échecs consécutifs) =====
  useEffect(() => {
    const list = services.data?.list;
    if (!list) return;
    (async () => {
      for (const s of list) {
        const key = s.key;
        const isDown = s.status === "offline";
        if (isDown) {
          failCounts.current[key] = (failCounts.current[key] ?? 0) + 1;
          if (failCounts.current[key] >= 2 && !alertedFor.current[key]) {
            const { data, error } = await supabase
              .from("incident_alerts")
              .insert({
                source: `health.${key}`,
                severity: "critical",
                title: `Service "${s.label}" hors ligne`,
                message: `Le service ${s.label} ne répond plus (${failCounts.current[key]} échecs consécutifs, latence ${s.ms ?? "?"}ms).`,
                context: { key, ms: s.ms, checked_at: new Date().toISOString() } as any,
              })
              .select("id")
              .maybeSingle();
            if (!error && data) {
              alertedFor.current[key] = data.id;
              audit({ action: "INSERT", module: "system-health", record_ref: `alert:${key}` });
            }
          }
        } else {
          if ((failCounts.current[key] ?? 0) > 0) failCounts.current[key] = 0;
          const alertId = alertedFor.current[key];
          if (alertId) {
            await supabase
              .from("incident_alerts")
              .update({ resolved: true, resolved_at: new Date().toISOString() })
              .eq("id", alertId);
            delete alertedFor.current[key];
            toast.success(`Service "${s.label}" rétabli`);
          }
        }
      }
    })();
  }, [services.data]);

  // ===== Actions =====
  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["sh-kpis"] });
    qc.invalidateQueries({ queryKey: ["sh-errors"] });
    qc.invalidateQueries({ queryKey: ["sh-logins"] });
    qc.invalidateQueries({ queryKey: ["sh-backups"] });
    qc.invalidateQueries({ queryKey: ["sh-services"] });
    qc.invalidateQueries({ queryKey: ["sh-integrity"] });
    qc.invalidateQueries({ queryKey: ["sh-alerts"] });
    qc.invalidateQueries({ queryKey: ["sh-perf"] });
    audit({ action: "VALIDATION", module: "system-health", record_ref: "refresh" });
    toast.success("Actualisation en cours");
  };

  const testServices = useMutation({
    mutationFn: async () => {
      setTesting(true);
      await qc.refetchQueries({ queryKey: ["sh-services"] });
      audit({ action: "VALIDATION", module: "system-health", record_ref: "test-services" });
    },
    onSettled: () => setTesting(false),
    onSuccess: () => toast.success("Services testés"),
  });

  // ===== Rôle guard =====
  if (rolesLoading) return <div className="p-6"><Skeleton className="h-8 w-64" /></div>;
  if (!isSuperAdmin) return <Navigate to="/" />;

  // ===== État global =====
  const overall = computeOverall({
    servicesOffline: services.data?.list.filter((s) => s.status === "offline").length ?? 0,
    servicesDegraded: services.data?.list.filter((s) => s.status === "degraded").length ?? 0,
    errorsToday: kpis.data?.errorsToday ?? 0,
    perfAvg: perf.data?.avg ?? 0,
    stocksNegatifs: integrity.data?.stocksNegatifs ?? 0,
  });

  return (
    <div className="container mx-auto space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl md:text-3xl font-bold">
            <Activity className="h-7 w-7" /> Santé du système
          </h1>
          <p className="text-muted-foreground text-sm">
            Supervision temps réel de l'ERP · Rafraîchissement automatique 30s
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={refreshAll} variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" /> Actualiser
          </Button>
          <Button onClick={() => testServices.mutate()} disabled={testing} variant="outline" size="sm">
            <PlayCircle className="mr-2 h-4 w-4" /> Tester les services
          </Button>
        </div>
      </div>

      {/* Overall + KPIs top */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OverallCard status={overall} />
        <StatCard icon={<Users className="h-5 w-5" />} label="Connexions aujourd'hui" value={kpis.data?.connectionsToday ?? "—"} />
        <StatCard icon={<Activity className="h-5 w-5" />} label="Opérations aujourd'hui" value={kpis.data?.opsToday ?? "—"} />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Erreurs aujourd'hui"
          value={kpis.data?.errorsToday ?? "—"}
          tone={(kpis.data?.errorsToday ?? 0) > 0 ? "error" : undefined}
        />
      </div>

      {/* Services + Perf */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2"><ServerCog className="h-5 w-5" /> Services</CardTitle></CardHeader>
          <CardContent>
            {services.isLoading ? <Skeleton className="h-24" /> : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {services.data?.list.map((s) => (
                  <div key={s.key} className="flex items-center justify-between rounded border p-3">
                    <div>
                      <div className="font-medium text-sm">{s.label}</div>
                      {s.ms !== undefined && (
                        <div className="text-xs text-muted-foreground">{s.ms} ms</div>
                      )}
                    </div>
                    <StatusBadge status={s.status} />
                  </div>
                ))}
              </div>
            )}
            {services.data?.checkedAt && (
              <div className="mt-3 text-xs text-muted-foreground">
                Dernière vérification : {services.data.checkedAt.toLocaleTimeString("fr-FR")}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Performance requêtes DB</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Requêtes tracées" value={perf.data?.count ?? 0} />
            <Row label="Moyenne" value={`${(perf.data?.avg ?? 0).toFixed(0)} ms`} />
            <Row label="Max" value={`${(perf.data?.max ?? 0).toFixed(0)} ms`} />
            <Row label="Erreurs" value={perf.data?.errors ?? 0} error={(perf.data?.errors ?? 0) > 0} />
          </CardContent>
        </Card>
      </div>

      {/* Activity + DB stats */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-5 w-5" /> Activité du jour</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <Row label="Commandes créées" value={kpis.data?.cmdToday ?? "—"} />
            <Row label="Factures créées" value={kpis.data?.factToday ?? "—"} />
            <Row label="Paiements enregistrés" value={kpis.data?.payToday ?? "—"} />
            <Row label="Mouvements de stock" value={kpis.data?.mvtToday ?? "—"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Database className="h-5 w-5" /> Base de données</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <Row label="Clients" value={kpis.data?.clients ?? "—"} />
            <Row label="Produits" value={kpis.data?.produits ?? "—"} />
            <Row label="Commandes" value={kpis.data?.commandes ?? "—"} />
            <Row label="Factures" value={kpis.data?.factures ?? "—"} />
            <Row label="Paiements" value={kpis.data?.paiements ?? "—"} />
            <Row label="Mouvements de stock" value={kpis.data?.mouvementsStock ?? "—"} />
          </CardContent>
        </Card>
      </div>

      {/* Sécurité + Sauvegardes + Intégrité */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Shield className="h-5 w-5" /> Sécurité (24h)</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Connexions échouées" value={kpis.data?.loginFailed24 ?? "—"} error={(kpis.data?.loginFailed24 ?? 0) > 10} />
            <Row label="Connexions réussies (aujourd'hui)" value={kpis.data?.connectionsToday ?? "—"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><HardDrive className="h-5 w-5" /> Sauvegardes</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {backups.data?.list[0] ? (
              <>
                <Row label="Dernière" value={new Date(backups.data.list[0].created_at).toLocaleString("fr-FR")} />
                <Row label="Statut" value={backups.data.list[0].statut ?? "—"} />
                <Row label="Taille" value={formatBytes(backups.data.list[0].taille_octets)} />
              </>
            ) : (
              <div className="text-muted-foreground">Aucune sauvegarde enregistrée</div>
            )}
            {backups.data?.next?.next_run_at && (
              <Row label="Prochaine" value={new Date(backups.data.next.next_run_at).toLocaleString("fr-FR")} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><AlertCircle className="h-5 w-5" /> Intégrité</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row
              label="Stocks négatifs"
              value={integrity.data?.stocksNegatifs ?? "—"}
              error={(integrity.data?.stocksNegatifs ?? 0) > 0}
            />
            <div className="text-xs text-muted-foreground pt-2">
              Vérifications légères. Pour un audit complet, voir <code>/admin/data-quality</code>.
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alertes */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-5 w-5" /> Alertes récentes</CardTitle></CardHeader>
        <CardContent>
          {alerts.isLoading ? <Skeleton className="h-16" /> : (alerts.data?.length ?? 0) === 0 ? (
            <div className="text-sm text-muted-foreground">Aucune alerte active</div>
          ) : (
            <div className="space-y-2">
              {alerts.data!.map((a: any) => (
                <div key={a.id} className="flex items-start justify-between gap-3 rounded border p-2 text-sm">
                  <div>
                    <div className="font-medium">{a.title}</div>
                    <div className="text-xs text-muted-foreground">{a.message}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={severityVariant(a.severity)}>{a.severity ?? "info"}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(a.created_at).toLocaleString("fr-FR")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Journal des 20 dernières erreurs */}
      <Card>
        <CardHeader><CardTitle className="text-base">20 dernières erreurs</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {errors.isLoading ? <Skeleton className="h-24" /> : (errors.data?.length ?? 0) === 0 ? (
            <div className="text-sm text-muted-foreground">Aucune erreur récente</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Gravité</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {errors.data!.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {new Date(e.occurred_at).toLocaleString("fr-FR")}
                    </TableCell>
                    <TableCell className="text-xs">{e.module ?? "—"}</TableCell>
                    <TableCell className="text-xs">{e.action ?? "—"}</TableCell>
                    <TableCell className="text-xs">{e.user_email ?? "—"}</TableCell>
                    <TableCell className="text-xs max-w-[380px] truncate" title={e.error_message ?? ""}>
                      {e.error_message ?? "—"}
                    </TableCell>
                    <TableCell><Badge variant={severityVariant(e.criticite)}>{e.criticite ?? "error"}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dernières connexions */}
      <Card>
        <CardHeader><CardTitle className="text-base">Dernières connexions</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {lastLogins.isLoading ? <Skeleton className="h-16" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Résultat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(lastLogins.data ?? []).map((l: any) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs">{new Date(l.created_at).toLocaleString("fr-FR")}</TableCell>
                    <TableCell className="text-xs">{l.user_id ?? "—"}</TableCell>
                    <TableCell className="text-xs">{l.ip ?? "—"}</TableCell>
                    <TableCell>
                      {l.success
                        ? <Badge variant="secondary">Succès</Badge>
                        : <Badge variant="destructive">Échec</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground text-center pt-4">
        Métriques CPU/RAM/disque non disponibles sur infrastructure serverless (Cloudflare Workers).
        Consultez le tableau de bord de l'hébergeur pour ces indicateurs.
      </div>
    </div>
  );
}

// ===== helpers =====

type Overall = "excellent" | "attention" | "critique";

function computeOverall(m: {
  servicesOffline: number; servicesDegraded: number; errorsToday: number; perfAvg: number; stocksNegatifs: number;
}): Overall {
  if (m.servicesOffline > 0 || m.errorsToday > 50 || m.stocksNegatifs > 0) return "critique";
  if (m.servicesDegraded > 0 || m.errorsToday > 5 || m.perfAvg > 500) return "attention";
  return "excellent";
}

function OverallCard({ status }: { status: Overall }) {
  const cfg = {
    excellent: { label: "Excellent", cls: "bg-emerald-500/10 border-emerald-500/40 text-emerald-600", icon: <CheckCircle2 className="h-6 w-6" /> },
    attention: { label: "Attention", cls: "bg-amber-500/10 border-amber-500/40 text-amber-600", icon: <AlertCircle className="h-6 w-6" /> },
    critique:  { label: "Critique", cls: "bg-destructive/10 border-destructive/40 text-destructive", icon: <XCircle className="h-6 w-6" /> },
  }[status];
  return (
    <Card className={`border-2 ${cfg.cls}`}>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          {cfg.icon}
          <div>
            <div className="text-xs uppercase tracking-wide opacity-80">État général</div>
            <div className="text-2xl font-bold">{cfg.label}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: ServiceStatus }) {
  if (status === "online") return <Badge className="bg-emerald-600 hover:bg-emerald-700">En ligne</Badge>;
  if (status === "degraded") return <Badge className="bg-amber-500 hover:bg-amber-600">Dégradé</Badge>;
  if (status === "offline") return <Badge variant="destructive">Hors ligne</Badge>;
  return <Badge variant="secondary">Inconnu</Badge>;
}

function StatCard({ icon, label, value, tone }: { icon?: React.ReactNode; label: string; value: React.ReactNode; tone?: "error" | "warn" }) {
  const color = tone === "error" ? "text-destructive" : tone === "warn" ? "text-amber-600" : "text-foreground";
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">{icon} {label}</div>
        <div className={`mt-2 text-3xl font-bold ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value, error }: { label: string; value: React.ReactNode; error?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${error ? "text-destructive" : ""}`}>{value}</span>
    </div>
  );
}

function severityVariant(s?: string | null): "default" | "secondary" | "destructive" | "outline" {
  if (s === "critical" || s === "high" || s === "error") return "destructive";
  if (s === "warning" || s === "medium") return "secondary";
  return "outline";
}

function formatBytes(n?: number | null): string {
  if (!n || n <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0; let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)} ${units[i]}`;
}