import { Card, CardContent } from "@/components/ui/card";
import { formatFCFA } from "@/lib/format";

import {
  Activity,
  Users,
  Calendar,
  CalendarDays,
  CalendarRange,
  LogIn,
  LogOut,
  ShieldAlert,
  ShieldX,
  Plus,
  Pencil,
  Trash2,
  Printer,
  FileDown,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Bell,
  Circle,
} from "lucide-react";
import type { AuditKpi } from "@/hooks/use-audit-events";

type Tile = {
  key: keyof AuditKpi;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
};

const TILES: Tile[] = [
  { key: "today", label: "Aujourd'hui", icon: Calendar, color: "text-warning" },
  { key: "week", label: "Cette semaine", icon: CalendarDays, color: "text-info" },
  { key: "month", label: "Ce mois", icon: CalendarRange, color: "text-indigo-500" },
  { key: "active_users_today", label: "Utilisateurs actifs", icon: Users, color: "text-success" },
  { key: "connected_now", label: "Connectés (15 min)", icon: Circle, color: "text-success" },
  { key: "logins", label: "Connexions", icon: LogIn, color: "text-success" },
  { key: "logouts", label: "Déconnexions", icon: LogOut, color: "text-muted-foreground" },
  { key: "login_failed", label: "Échecs connexion", icon: ShieldX, color: "text-destructive" },
  { key: "creations", label: "Créations", icon: Plus, color: "text-success" },
  { key: "modifications", label: "Modifications", icon: Pencil, color: "text-warning" },
  { key: "suppressions", label: "Suppressions", icon: Trash2, color: "text-destructive" },
  { key: "impressions", label: "Impressions", icon: Printer, color: "text-muted-foreground" },
  { key: "exports_pdf", label: "Exports PDF", icon: FileDown, color: "text-destructive" },
  { key: "exports_excel", label: "Exports Excel/CSV", icon: FileSpreadsheet, color: "text-success" },
  { key: "validations", label: "Validations", icon: CheckCircle2, color: "text-success" },
  { key: "annulations", label: "Annulations", icon: XCircle, color: "text-warning" },
  { key: "system_errors", label: "Erreurs système", icon: AlertTriangle, color: "text-destructive" },
  { key: "security_alerts", label: "Alertes sécurité", icon: Bell, color: "text-destructive" },
];

type Props = { kpi?: AuditKpi; totalEvents?: number };

export function AuditStats({ kpi, totalEvents }: Props) {
  const v = (k: keyof AuditKpi) => Number(kpi?.[k] ?? 0);
  return (
    <div className="space-y-3">
      {typeof totalEvents === "number" && (
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Activity className="h-6 w-6 text-warning" />
            <div className="text-sm text-muted-foreground">Événements sur la période</div>
            <div className="ml-auto text-2xl font-bold tabular-nums">
              {formatFCFA(totalEvents, false)}
            </div>
          </CardContent>
        </Card>
      )}
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {TILES.map(({ key, label, icon: Icon, color }) => (
          <Card key={key}>
            <CardContent className="flex items-center gap-2 p-3">
              <Icon className={`h-5 w-5 shrink-0 ${color}`} />
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
