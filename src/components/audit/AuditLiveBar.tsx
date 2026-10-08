import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Radio, RefreshCw, XCircle, Trash2, LogIn, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { ACTION_LABEL } from "@/lib/audit-helpers";

type LiveStatus = "connecting" | "live" | "down";

type PresetKey = "errors" | "deletions" | "logins" | "last15";

type Props = {
  onApplyPreset?: (preset: PresetKey) => void;
};

/**
 * Barre "temps réel" du journal d'audit :
 *  - Indicateur LIVE (canal Realtime audit_events + security_alerts)
 *  - Compteur d'événements arrivés depuis la dernière consultation
 *  - Toasts pour alertes critiques et audits en échec
 *  - Boutons de filtres rapides
 */
export function AuditLiveBar({ onApplyPreset }: Props) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const [newCount, setNewCount] = useState(0);
  const mountedAt = useRef<number>(Date.now());

  useEffect(() => {
    const channel = supabase
      .channel("audit-live-bar")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "audit_events" },
        (payload) => {
          setNewCount((c) => c + 1);
          const row = payload.new as {
            action?: string;
            status?: string;
            user_email?: string | null;
            table_name?: string | null;
            error_message?: string | null;
          };
          if (row.status === "error") {
            toast.error(
              `Échec — ${ACTION_LABEL[row.action ?? ""] ?? row.action ?? "action"}`,
              {
                description: [row.user_email, row.table_name, row.error_message]
                  .filter(Boolean)
                  .join(" · ")
                  .slice(0, 160),
              },
            );
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "security_alerts" },
        (payload) => {
          const row = payload.new as {
            criticite?: string;
            alert_type?: string;
            message?: string;
            user_email?: string | null;
          };
          const desc = [row.user_email, row.message].filter(Boolean).join(" · ").slice(0, 200);
          if (row.criticite === "critical") {
            toast.error(`Alerte critique — ${row.alert_type ?? "sécurité"}`, {
              description: desc,
              duration: 12000,
            });
          } else if (row.criticite === "warning") {
            toast.warning(`Alerte — ${row.alert_type ?? "sécurité"}`, { description: desc });
          }
        },
      )
      .subscribe((s) => {
        if (s === "SUBSCRIBED") setStatus("live");
        else if (s === "CHANNEL_ERROR" || s === "CLOSED" || s === "TIMED_OUT") setStatus("down");
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const uptimeMin = Math.max(0, Math.floor((Date.now() - mountedAt.current) / 60000));

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card px-3 py-2">
      <Badge
        variant={status === "live" ? "default" : status === "down" ? "destructive" : "secondary"}
        className="gap-1.5"
        aria-live="polite"
      >
        <span className="relative flex h-2 w-2">
          {status === "live" && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
          )}
          <span
            className={`relative inline-flex h-2 w-2 rounded-full ${
              status === "live"
                ? "bg-success"
                : status === "down"
                  ? "bg-destructive"
                  : "bg-warning"
            }`}
          />
        </span>
        <Radio className="h-3 w-3" />
        {status === "live" ? "Temps réel actif" : status === "down" ? "Déconnecté" : "Connexion…"}
      </Badge>

      {newCount > 0 ? (
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1.5"
          onClick={() => {
            qc.invalidateQueries({ queryKey: ["audit-events"] });
            qc.invalidateQueries({ queryKey: ["audit-events-paginated"] });
            qc.invalidateQueries({ queryKey: ["audit-events-stats"] });
            qc.invalidateQueries({ queryKey: ["audit-kpi-v2"] });
            qc.invalidateQueries({ queryKey: ["security-alerts"] });
            setNewCount(0);
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {newCount} nouveau{newCount > 1 ? "x" : ""} — rafraîchir
        </Button>
      ) : (
        <span className="text-xs text-muted-foreground">Session : {uptimeMin} min</span>
      )}

      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Filtres rapides :</span>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 px-2 text-xs"
          onClick={() => onApplyPreset?.("last15")}
        >
          <Clock className="h-3.5 w-3.5" /> 15 min
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 px-2 text-xs text-destructive hover:text-destructive"
          onClick={() => onApplyPreset?.("errors")}
        >
          <XCircle className="h-3.5 w-3.5" /> Échecs
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 px-2 text-xs"
          onClick={() => onApplyPreset?.("deletions")}
        >
          <Trash2 className="h-3.5 w-3.5" /> Suppressions
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 px-2 text-xs"
          onClick={() => onApplyPreset?.("logins")}
        >
          <LogIn className="h-3.5 w-3.5" /> Connexions
        </Button>
      </div>
    </div>
  );
}

export type { PresetKey };