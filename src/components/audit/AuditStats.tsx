import { Card, CardContent } from "@/components/ui/card";
import { formatFCFA } from "@/lib/format";

import type { AuditKpi } from "@/hooks/use-audit-events";

type Tile = {
  key: keyof AuditKpi;
  label: string;
};

const TILES: Tile[] = [
  { key: "today", label: "Aujourd'hui" },
  { key: "week", label: "Cette semaine" },
  { key: "month", label: "Ce mois" },
  { key: "active_users_today", label: "Utilisateurs actifs" },
  { key: "connected_now", label: "Connectés (15 min)" },
  { key: "logins", label: "Connexions" },
  { key: "logouts", label: "Déconnexions" },
  { key: "login_failed", label: "Échecs connexion" },
  { key: "creations", label: "Créations" },
  { key: "modifications", label: "Modifications" },
  { key: "suppressions", label: "Suppressions" },
  { key: "impressions", label: "Impressions" },
  { key: "exports_pdf", label: "Exports PDF" },
  { key: "exports_excel", label: "Exports Excel/CSV" },
  { key: "validations", label: "Validations" },
  { key: "annulations", label: "Annulations" },
  { key: "system_errors", label: "Erreurs système" },
  { key: "security_alerts", label: "Alertes sécurité" },
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
            <div className="ml-auto text-2xl font-semibold tabular-nums">
              {formatFCFA(totalEvents, false)}
            </div>
          </CardContent>
        </Card>
      )}
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {TILES.map(({ key, label }) => (
          <Card key={key}>
            <CardContent className="flex items-center gap-2 p-3">
              <div className="min-w-0">
                <div className="text-lg font-semibold tabular-nums leading-tight">
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
