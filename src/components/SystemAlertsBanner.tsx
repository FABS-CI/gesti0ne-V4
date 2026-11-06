import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserRoles } from "@/hooks/use-user-roles";

/**
 * Bannière globale d'alertes système.
 * P2 perf : plus de polling 60s → une seule requête initiale, puis Realtime
 * sur `incident_alerts` pour rester à jour sans marteler la base.
 */
export function SystemAlertsBanner() {
  const { isSuperAdmin } = useUserRoles();
  const seen = useRef<Set<string>>(new Set());
  const initialized = useRef(false);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["system-alerts-banner"],
    enabled: isSuperAdmin,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incident_alerts")
        .select("id, title, severity, message, created_at, source")
        .eq("resolved", false)
        .like("source", "health.%")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) return [];
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!isSuperAdmin) return;
    const channel = supabase
      .channel("incident-alerts-banner")
      .on("postgres_changes", { event: "*", schema: "public", table: "incident_alerts" }, () =>
        qc.invalidateQueries({ queryKey: ["system-alerts-banner"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isSuperAdmin, qc]);

  useEffect(() => {
    if (!data) return;
    if (!initialized.current) {
      data.forEach((a) => seen.current.add(a.id));
      initialized.current = true;
      return;
    }
    for (const a of data) {
      if (!seen.current.has(a.id)) {
        seen.current.add(a.id);
        toast.error(a.title, { description: a.message ?? undefined, duration: 10_000 });
      }
    }
  }, [data]);

  if (!isSuperAdmin || !data || data.length === 0) return null;

  const critical = data.filter((a) => a.severity === "critical").length;
  return (
    <div className="bg-destructive/10 border-b border-destructive/30 px-4 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-destructive">
          <span className="font-medium">
            {data.length} incident{data.length > 1 ? "s" : ""} actif{data.length > 1 ? "s" : ""}
            {critical > 0 && ` (${critical} critique${critical > 1 ? "s" : ""})`}
          </span>
          <span className="hidden md:inline text-muted-foreground truncate max-w-[50ch]">
            · {data[0].title}
          </span>
        </div>
        <Link
          to="/admin/sante-systeme"
          className="text-xs font-medium underline text-destructive hover:opacity-80"
        >
          Voir la santé du système →
        </Link>
      </div>
    </div>
  );
}
