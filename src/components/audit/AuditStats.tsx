import { Card, CardContent } from "@/components/ui/card";
import { formatFCFA } from "@/lib/format";

import { Circle } from "lucide-react";
import type { AuditKpi } from "@/hooks/use-audit-events";

type Tile = {
  key: keyof AuditKpi;
  label: string;
  color: string;
};

const TILES: Tile[] = [
  { key: "today", label: "Aujourd'hui", color: "text-warning" },
  { key: "week", label: "Cette semaine", color: "text-info" },
  { key: "month", label: "Ce mois", color: "text-indigo-500" },
  { key: "active_users_today", label: "Utilisateurs actifs", color: "text-success" },
  { key: "connected_now", label: "Connectés (15 min)", color: "text-success" },
  { key: "logins", label: "Connexions", color: "text-success" },
  { key: "logouts", label: "Déconnexions", color: "text-muted-foreground" },
  { key: "login_failed", label: "Échecs connexion", color: "text-destructive" },
  { key: "creations", label: "Créations", color: "text-success" },
  { key: "modifications", label: "Modifications", color: "text-warning" },
  { key: "suppressions", label: "Suppressions", color: "text-destructive" },
  { key: "impressions", label: "Impressions", color: "text-muted-foreground" },
  { key: "exports_pdf", label: "Exports PDF", color: "text-destructive" },
  { key: "exports_excel", label: "Exports Excel/CSV", color: "text-success" },
  { key: "validations", label: "Validations", color: "text-success" },
  { key: "annulations", label: "Annulations", color: "text-warning" },
  { key: "system_errors", label: "Erreurs système", color: "text-destructive" },
  { key: "security_alerts", label: "Alertes sécurité", color: "text-destructive" },
];

type Props = { kpi?: AuditKpi; totalEvents?: number };

export function AuditStats({ kpi, totalEvents }: Props) {
  const v = (k: keyof AuditKpi) => Number(kpi?.[k] ?? 0);
  return (
    <div className="space-y-3">
      {typeof totalEvents === "number" && (
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="text-sm text-muted-foreground">Événements sur la période</div>
            <div className="ml-auto text-2xl font-bold tabular-nums">
              {formatFCFA(totalEvents, false)}
            </div>
          </CardContent>
        </Card>
      )}
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {TILES.map(({ key, label, color }) => (
          <Card key={key}>
            <CardContent className="flex items-center gap-2 p-3">
              <div className="min-w-0">
                <div className="text-lg font-bold tabular-nums leading-tight">
                  {formatFCFA(v(key), false)}
                </div>
                <div className="truncate text-xs text-muted-foreground">{label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
