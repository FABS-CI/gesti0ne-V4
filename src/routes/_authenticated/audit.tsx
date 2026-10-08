import { formatDateTime } from "@/lib/format";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { History, ShieldAlert, Download, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { exportCsv } from "@/lib/export-csv";
import { exportListePDF } from "@/lib/pdf/exportListe";
import { ACTION_LABEL, type AuditRow } from "@/lib/audit-helpers";
import {
  useAuditEvents,
  useAuditEventsStats,
  useAuditEventsPaginated,
  useAuditKpi,
  useSecurityAlerts,
} from "@/hooks/use-audit-events";
import { useLoginHistoryLast } from "@/hooks/use-login-history-last";
import { useOnlinePresence } from "@/hooks/use-online-presence";
import { useIpGeo } from "@/hooks/use-ip-geo";
import { parseUserAgent } from "@/lib/ua-parse";
import { AuditStats } from "@/components/audit/AuditStats";
import { AuditFilters } from "@/components/audit/AuditFilters";
import { ChronologieTab } from "@/components/audit/ChronologieTab";
import { ByUserTab } from "@/components/audit/ByUserTab";
import { OnlineTab, type ConnectedUser } from "@/components/audit/OnlineTab";
import { OnlineUserDialog } from "@/components/audit/OnlineUserDialog";
import { EventDetailDialog } from "@/components/audit/EventDetailDialog";
import { AuditCharts } from "@/components/audit/AuditCharts";
import { AuditLiveBar, type PresetKey } from "@/components/audit/AuditLiveBar";
import { Badge } from "@/components/ui/badge";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/audit")({
  component: AuditPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function AuditPage() {
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState<string>("");
  const [actionFilter, setActionFilter] = useState<string>("");
  const [userFilter, setUserFilter] = useState<string>("");
  const [periodFilter, setPeriodFilter] = useState<string>("7");
  const [selected, setSelected] = useState<AuditRow | null>(null);
  const [tab, setTab] = useState<"all" | "by-user" | "online" | "alerts">("all");
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [onlineWindowMin, setOnlineWindowMin] = useState<number>(15);
  const [refreshSec, setRefreshSec] = useState<number>(30);
  const [onlineSearch, setOnlineSearch] = useState("");
  const [onlineIp, setOnlineIp] = useState("");
  const [onlinePage, setOnlinePage] = useState(1);
  const [selectedOnlineUser, setSelectedOnlineUser] = useState<string | null>(null);
  const ONLINE_PAGE_SIZE = 20;
  const [chronoPage, setChronoPage] = useState(1);
  const CHRONO_PAGE_SIZE = 50;

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), refreshSec * 1000);
    return () => window.clearInterval(id);
  }, [refreshSec]);

  const { data, isLoading, error } = useAuditEvents(moduleFilter, periodFilter);
  const { data: loginMap } = useLoginHistoryLast();
  const presences = useOnlinePresence();
  const { data: stats } = useAuditEventsStats({
    moduleFilter,
    periodFilter,
    userFilter,
    actionFilter,
    search,
  });
  const { data: chrono, isLoading: chronoLoading } = useAuditEventsPaginated({
    moduleFilter,
    periodFilter,
    userFilter,
    actionFilter,
    search,
    page: chronoPage,
    pageSize: CHRONO_PAGE_SIZE,
  });
  const { data: kpi } = useAuditKpi();
  const { data: alerts } = useSecurityAlerts(50);
  useEffect(() => {
    setChronoPage(1);
  }, [moduleFilter, periodFilter, userFilter, actionFilter, search]);

  const actions = useMemo(() => {
    const set = new Set<string>();
    (data ?? []).forEach((r) => set.add(r.action));
    return Array.from(set).sort();
  }, [data]);

  const users = useMemo(() => {
    const set = new Set<string>();
    (data ?? []).forEach((r) => r.user_email && set.add(r.user_email));
    return Array.from(set).sort();
  }, [data]);

  const rows = (data ?? []).filter((r) => {
    if (actionFilter && r.action !== actionFilter) return false;
    if (userFilter && r.user_email !== userFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (r.user_email ?? "").toLowerCase().includes(q) ||
      r.table_name.toLowerCase().includes(q) ||
      (r.record_id ?? "").toLowerCase().includes(q) ||
      (ACTION_LABEL[r.action] ?? r.action).toLowerCase().includes(q)
    );
  });

  const perUser = useMemo(() => {
    const map = new Map<
      string,
      { email: string; total: number; last: string; actions: Record<string, number> }
    >();
    (data ?? []).forEach((r) => {
      const key = r.user_email ?? "—";
      const cur = map.get(key) ?? { email: key, total: 0, last: r.occurred_at, actions: {} };
      cur.total += 1;
      if (r.occurred_at > cur.last) cur.last = r.occurred_at;
      const label = ACTION_LABEL[r.action] ?? r.action;
      cur.actions[label] = (cur.actions[label] ?? 0) + 1;
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [data]);

  const baseConnectedUsers = useMemo<ConnectedUser[]>(() => {
    const cutoff = nowTick - onlineWindowMin * 60 * 1000;
    const map = new Map<string, ConnectedUser>();
    (data ?? []).forEach((r) => {
      const t = new Date(r.occurred_at).getTime();
      if (t < cutoff) return;
      const key = r.user_email ?? r.user_id ?? "—";
      const cur = map.get(key) ?? {
        email: r.user_email ?? "—",
        user_id: r.user_id,
        last: r.occurred_at,
        last_action: r.action,
        ip: r.ip_address,
        count: 0,
        device: r.device ?? null,
        browser: r.browser ?? null,
        os: r.os ?? null,
        city: r.city ?? null,
        country: r.country ?? null,
        country_code: r.country_code ?? null,
      };
      cur.count += 1;
      if (r.occurred_at > cur.last) {
        cur.last = r.occurred_at;
        cur.last_action = r.action;
        cur.ip = r.ip_address ?? cur.ip;
        cur.device = r.device ?? cur.device;
        cur.browser = r.browser ?? cur.browser;
        cur.os = r.os ?? cur.os;
        cur.city = r.city ?? cur.city;
        cur.country = r.country ?? cur.country;
        cur.country_code = r.country_code ?? cur.country_code;
      }
      map.set(key, cur);
    });
    // Fusionne la présence temps réel : utilisateurs actuellement connectés
    // via websocket, même sans action récente dans l'audit.
    presences.forEach((p) => {
      const key = p.email || p.user_id;
      const existing = map.get(key);
      const merged: ConnectedUser = existing ?? {
        email: p.email,
        user_id: p.user_id,
        last: p.last_activity,
        last_action: "LOGIN",
        ip: null,
        count: 0,
      };
      merged.is_live = true;
      merged.nom_complet = p.nom_complet ?? merged.nom_complet;
      merged.prenom = p.prenom ?? merged.prenom;
      merged.fonction = p.fonction ?? merged.fonction;
      merged.connected_at = p.connected_at;
      // Propage les enrichissements client (IP publique, géo, appareil)
      merged.ip = merged.ip ?? p.ip ?? null;
      merged.city = merged.city ?? p.city ?? null;
      merged.region = merged.region ?? p.region ?? null;
      merged.country = merged.country ?? p.country ?? null;
      merged.country_code = merged.country_code ?? p.country_code ?? null;
      merged.isp = merged.isp ?? p.isp ?? null;
      merged.device = merged.device ?? p.device ?? null;
      merged.browser = merged.browser ?? p.browser ?? null;
      merged.os = merged.os ?? p.os ?? null;
      if (new Date(p.last_activity).getTime() > new Date(merged.last).getTime()) {
        merged.last = p.last_activity;
      }
      map.set(key, merged);
    });
    return Array.from(map.values()).sort((a, b) => (a.last < b.last ? 1 : -1));
  }, [data, nowTick, onlineWindowMin, presences]);

  // Enrichit chaque utilisateur avec sa dernière connexion (IP + user-agent + device).
  const usersWithLogin = useMemo<ConnectedUser[]>(() => {
    return baseConnectedUsers.map((u) => {
      const info = loginMap?.get(u.email.toLowerCase());
      const ua = parseUserAgent(info?.user_agent);
      return {
        ...u,
        ip: u.ip ?? info?.ip_address ?? null,
        device: u.device ?? info?.device ?? ua.device,
        browser: u.browser ?? ua.browser,
        os: u.os ?? ua.os,
      };
    });
  }, [baseConnectedUsers, loginMap]);

  // Résout la géolocalisation des IP présentes.
  const ipList = useMemo(
    () => usersWithLogin.map((u) => u.ip).filter((x): x is string => !!x),
    [usersWithLogin],
  );
  const geoMap = useIpGeo(ipList);

  const connectedUsers = useMemo<ConnectedUser[]>(() => {
    return usersWithLogin.map((u) => {
      const g = u.ip ? geoMap[u.ip] : undefined;
      return g
        ? {
            ...u,
            city: u.city ?? g.city,
            region: u.region ?? g.region,
            country: u.country ?? g.country,
            country_code: u.country_code ?? g.country_code,
            isp: u.isp ?? g.isp,
            lat: u.lat ?? g.lat,
            lon: u.lon ?? g.lon,
          }
        : u;
    });
  }, [usersWithLogin, geoMap]);

  const filteredConnected = useMemo(() => {
    const q = onlineSearch.trim().toLowerCase();
    const ipq = onlineIp.trim().toLowerCase();
    return connectedUsers.filter((u) => {
      if (q && !u.email.toLowerCase().includes(q)) return false;
      if (ipq && !(u.ip ?? "").toLowerCase().includes(ipq)) return false;
      return true;
    });
  }, [connectedUsers, onlineSearch, onlineIp]);

  const onlineTotalPages = Math.max(1, Math.ceil(filteredConnected.length / ONLINE_PAGE_SIZE));
  const onlinePageSafe = Math.min(onlinePage, onlineTotalPages);
  const onlinePageRows = filteredConnected.slice(
    (onlinePageSafe - 1) * ONLINE_PAGE_SIZE,
    onlinePageSafe * ONLINE_PAGE_SIZE,
  );

  const selectedUserEvents = useMemo(() => {
    if (!selectedOnlineUser) return [];
    return (data ?? [])
      .filter((r) => (r.user_email ?? r.user_id ?? "—") === selectedOnlineUser)
      .slice(0, 50);
  }, [selectedOnlineUser, data]);

  function onExportConnected() {
    exportCsv(
      "utilisateurs-connectes",
      ["Utilisateur", "Dernière action", "Il y a (min)", "Adresse IP", "Actions"],
      filteredConnected.map((u) => [
        u.email,
        ACTION_LABEL[u.last_action] ?? u.last_action,
        String(Math.max(0, Math.floor((nowTick - new Date(u.last).getTime()) / 60000))),
        u.ip ?? "",
        String(u.count),
      ]),
      {
        pageTitle: "UTILISATEURS CONNECTÉS",
        summary: [
          { label: "Seuil d'activité", value: `${onlineWindowMin} min` },
          { label: "Utilisateurs connectés", value: String(filteredConnected.length) },
          { label: "Rafraîchissement", value: `${refreshSec} s` },
        ],
      },
    );
  }

  async function onExportConnectedPDF() {
    const colonnes = ["Utilisateur", "Dernière action", "Il y a (min)", "Adresse IP", "Actions"];
    const lignes = filteredConnected.map((u) => [
      u.email,
      ACTION_LABEL[u.last_action] ?? u.last_action,
      String(Math.max(0, Math.floor((nowTick - new Date(u.last).getTime()) / 60000))),
      u.ip ?? "",
      String(u.count),
    ]);
    await exportListePDF({
      titre: "Utilisateurs connectés",
      colonnes,
      lignes,
      filtres: [
        `Seuil : ${onlineWindowMin} min`,
        `Rafraîchissement : ${refreshSec} s`,
        `${filteredConnected.length} utilisateur(s)`,
      ],
      filename: "utilisateurs-connectes",
    });
  }

  const totalEvents = stats?.totalEvents ?? data?.length ?? 0;
  const uniqueUsers = stats?.uniqueUsers ?? users.length;
  const todayCount =
    stats?.todayEvents ??
    (data ?? []).filter((r) => new Date(r.occurred_at).toDateString() === new Date().toDateString())
      .length;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <ShieldAlert className="h-10 w-10 text-destructive" />
        <h1 className="ds-page-title">Accès restreint</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Le journal d'audit est réservé au Super Administrateur.
        </p>
      </div>
    );
  }

  function applyPreset(preset: PresetKey) {
    switch (preset) {
      case "last15":
        setPeriodFilter("1");
        setActionFilter("");
        setSearch("");
        break;
      case "errors":
        setSearch("error");
        setActionFilter("");
        break;
      case "deletions":
        setActionFilter("DELETE");
        setSearch("");
        break;
      case "logins":
        setActionFilter("LOGIN");
        setSearch("");
        break;
    }
  }

  function onExport() {
    exportCsv(
      "journal-audit",
      ["Date", "Utilisateur", "Action", "Module", "Référence"],
      rows.map((r) => [
        formatDateTime(r.occurred_at),
        r.user_email ?? "",
        ACTION_LABEL[r.action] ?? r.action,
        r.table_name,
        r.record_ref ?? r.record_id ?? "",
      ]),
      {
        pageTitle: "JOURNAL D'AUDIT",
        summary: [
          { label: "Événements exportés", value: String(rows.length) },
          { label: "Événements totaux", value: String(totalEvents) },
          { label: "Événements du jour", value: String(todayCount) },
          { label: "Utilisateurs distincts", value: String(uniqueUsers) },
          {
            label: "Modules concernés",
            value: String(new Set(rows.map((r) => r.table_name)).size),
          },
        ],
      },
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <History className="h-6 w-6 text-warning" />
          <div>
            <h1 className="ds-page-title">Journal d'audit</h1>
            <p className="text-sm text-muted-foreground">
              Traçabilité complète — {rows.length} / {totalEvents} événement(s)
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onExport}>
          <Download className="mr-2 h-4 w-4" /> Exporter
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const blob = new Blob([JSON.stringify(rows, null, 2)], {
              type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `journal-audit-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Download className="mr-2 h-4 w-4" /> JSON
        </Button>
      </div>

      <AuditLiveBar onApplyPreset={applyPreset} />

      <AuditStats kpi={kpi} totalEvents={totalEvents} />

      <AuditCharts days={Number(periodFilter) || 30} />

      <AuditFilters
        search={search}
        setSearch={setSearch}
        periodFilter={periodFilter}
        setPeriodFilter={setPeriodFilter}
        userFilter={userFilter}
        setUserFilter={setUserFilter}
        moduleFilter={moduleFilter}
        setModuleFilter={setModuleFilter}
        actionFilter={actionFilter}
        setActionFilter={setActionFilter}
        users={users}
        actions={actions}
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="all">Chronologie</TabsTrigger>
          <TabsTrigger value="by-user">Par utilisateur</TabsTrigger>
          <TabsTrigger value="online" className="gap-2">
            <Circle className="h-2 w-2 fill-success text-success" />
            Connectés ({connectedUsers.length})
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-2">
            <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
            Alertes ({alerts?.filter((a) => !a.acknowledged_at).length ?? 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <ChronologieTab
            rows={chrono?.rows ?? []}
            isLoading={chronoLoading}
            onSelect={setSelected}
            onUserClick={(email) => setUserFilter(email)}
            page={chronoPage}
            pageSize={CHRONO_PAGE_SIZE}
            totalCount={chrono?.totalCount ?? 0}
            onPageChange={setChronoPage}
          />
        </TabsContent>

        <TabsContent value="by-user" className="mt-4">
          <ByUserTab
            perUser={perUser}
            onView={(email) => {
              setUserFilter(email);
              setTab("all");
            }}
          />
        </TabsContent>

        <TabsContent value="online" className="mt-4">
          <OnlineTab
            onlineSearch={onlineSearch}
            setOnlineSearch={setOnlineSearch}
            onlineIp={onlineIp}
            setOnlineIp={setOnlineIp}
            onlineWindowMin={onlineWindowMin}
            setOnlineWindowMin={setOnlineWindowMin}
            refreshSec={refreshSec}
            setRefreshSec={setRefreshSec}
            filteredConnected={filteredConnected}
            onlinePageRows={onlinePageRows}
            onlinePageSafe={onlinePageSafe}
            onlineTotalPages={onlineTotalPages}
            onlinePageSize={ONLINE_PAGE_SIZE}
            setOnlinePage={(updater) => setOnlinePage(updater)}
            nowTick={nowTick}
            onSelectUser={setSelectedOnlineUser}
            onExportCsv={onExportConnected}
            onExportPDF={onExportConnectedPDF}
          />

          <OnlineUserDialog
            selectedOnlineUser={selectedOnlineUser}
            onClose={() => setSelectedOnlineUser(null)}
            selectedUserEvents={selectedUserEvents}
            onViewAll={() => {
              if (selectedOnlineUser) {
                setUserFilter(selectedOnlineUser);
                setTab("all");
                setSelectedOnlineUser(null);
              }
            }}
          />
        </TabsContent>

        <TabsContent value="alerts" className="mt-4">
          <div className="rounded-lg border">
            {(alerts ?? []).length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Aucune alerte de sécurité.
              </div>
            ) : (
              <ul className="divide-y">
                {(alerts ?? []).map((a) => (
                  <li key={a.id} className="flex items-start gap-3 p-3">
                    <Badge
                      variant={a.criticite === "critical" ? "destructive" : "secondary"}
                      className="mt-0.5"
                    >
                      {a.criticite}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{a.message}</div>
                      <div className="text-xs text-muted-foreground">
                        {a.alert_type} · {a.user_email ?? "—"} · {a.ip_address ?? "—"}
                        {a.city ? ` · ${a.city}` : ""}
                        {a.country ? `, ${a.country}` : ""}
                      </div>
                    </div>
                    <div className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(a.created_at)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <EventDetailDialog selected={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
