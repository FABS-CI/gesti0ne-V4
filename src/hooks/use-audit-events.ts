import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AuditRow } from "@/lib/audit-helpers";

export function useAuditEvents(moduleFilter: string, periodFilter: string) {
  return useQuery({
    queryKey: ["audit-events", moduleFilter, periodFilter],
    queryFn: async () => {
      let q = supabase
        .from("audit_events")
        .select(
          "id, user_email, user_id, action, module, table_name, record_id, record_ref, occurred_at, old_values, new_values, changes, ip_address, user_agent, url, http_method, status, status_code, duration_ms, error_message, criticite, session_id, correlation_id, city, country, country_code, browser, browser_version, os, device, screen_resolution, timezone",
        )
        .order("occurred_at", { ascending: false })
        .limit(500);
      if (moduleFilter) q = q.eq("table_name", moduleFilter);
      if (periodFilter !== "all") {
        const since = new Date();
        since.setDate(since.getDate() - Number(periodFilter));
        q = q.gte("occurred_at", since.toISOString());
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as AuditRow[];
    },
    retry: false,
  });
}

/** Statistiques agrégées côté base — utilisées par les KPI d'audit. */
export function useAuditEventsStats(params: {
  moduleFilter: string;
  periodFilter: string;
  userFilter: string;
  actionFilter: string;
  search: string;
}) {
  const { moduleFilter, periodFilter, userFilter, actionFilter, search } = params;
  return useQuery({
    queryKey: ["audit-events-stats", moduleFilter, periodFilter, userFilter, actionFilter, search],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("audit_events_stats", {
        p_module: moduleFilter || undefined,
        p_period_days: periodFilter === "all" ? undefined : Number(periodFilter),
        p_user_email: userFilter || undefined,
        p_action: actionFilter || undefined,
        p_search: search.trim() || undefined,
      });
      if (error) throw error;
      const row = (data ?? [])[0];
      return {
        totalEvents: Number(row?.total_events ?? 0),
        uniqueUsers: Number(row?.unique_users ?? 0),
        todayEvents: Number(row?.today_events ?? 0),
        connected15min: Number(row?.connected_15min ?? 0),
      };
    },
    retry: false,
  });
}

/** Liste paginée d'événements — utilisée par la Chronologie. */
export function useAuditEventsPaginated(params: {
  moduleFilter: string;
  periodFilter: string;
  userFilter: string;
  actionFilter: string;
  search: string;
  page: number;
  pageSize: number;
}) {
  const { moduleFilter, periodFilter, userFilter, actionFilter, search, page, pageSize } = params;
  return useQuery({
    queryKey: [
      "audit-events-paginated",
      moduleFilter,
      periodFilter,
      userFilter,
      actionFilter,
      search,
      page,
      pageSize,
    ],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("audit_events_list", {
        p_module: moduleFilter || undefined,
        p_period_days: periodFilter === "all" ? undefined : Number(periodFilter),
        p_user_email: userFilter || undefined,
        p_action: actionFilter || undefined,
        p_search: search.trim() || undefined,
        p_page: page,
        p_page_size: pageSize,
      });
      if (error) throw error;
      const rows = (data ?? []) as (AuditRow & { total_count: number })[];
      const totalCount = Number(rows[0]?.total_count ?? 0);
      return { rows: rows as AuditRow[], totalCount };
    },
    retry: false,
    placeholderData: (prev) => prev,
  });
}

export type AuditKpi = {
  today: number;
  week: number;
  month: number;
  active_users_today: number;
  connected_now: number;
  logins: number;
  logouts: number;
  login_failed: number;
  creations: number;
  modifications: number;
  suppressions: number;
  impressions: number;
  exports_pdf: number;
  exports_excel: number;
  validations: number;
  annulations: number;
  system_errors: number;
  security_alerts: number;
};

/** Dashboard KPI d'audit — 18 compteurs en un seul appel + realtime. */
export function useAuditKpi() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["audit-kpi-v2"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("audit_stats_v2");
      if (error) throw error;
      return (data ?? {}) as AuditKpi;
    },
    retry: false,
    staleTime: 15_000,
  });

  useEffect(() => {
    const ch = supabase
      .channel("audit-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "audit_events" },
        () => {
          qc.invalidateQueries({ queryKey: ["audit-kpi-v2"] });
          qc.invalidateQueries({ queryKey: ["audit-events"] });
          qc.invalidateQueries({ queryKey: ["audit-events-stats"] });
          qc.invalidateQueries({ queryKey: ["audit-events-paginated"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "security_alerts" },
        () => {
          qc.invalidateQueries({ queryKey: ["audit-kpi-v2"] });
          qc.invalidateQueries({ queryKey: ["security-alerts"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  return query;
}

export type SecurityAlertRow = {
  id: string;
  created_at: string;
  alert_type: string;
  criticite: "info" | "warning" | "critical";
  user_email: string | null;
  ip_address: string | null;
  country: string | null;
  city: string | null;
  message: string;
  acknowledged_at: string | null;
};

export function useSecurityAlerts(limit = 100) {
  return useQuery({
    queryKey: ["security-alerts", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("security_alerts")
        .select(
          "id, created_at, alert_type, criticite, user_email, ip_address, country, city, message, acknowledged_at",
        )
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as SecurityAlertRow[];
    },
    retry: false,
  });
}
