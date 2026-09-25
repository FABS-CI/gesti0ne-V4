import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardOverview } from "@/hooks/use-dashboard-overview";

export function DashboardStockAlerts({ data }: { data: DashboardOverview | undefined }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Alertes de stock
        </CardTitle>
        <Link to="/stock" className="text-sm text-primary hover:underline">
          Voir le stock
        </Link>
      </CardHeader>
      <CardContent>
        {(data?.stockBas.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun produit en stock bas.</p>
        ) : (
          <ul className="divide-y">
            {data?.stockBas.slice(0, 10).map((p, i) => (
              <li key={i} className="flex items-center justify-between py-2">
                <span className="truncate text-sm">{p.titre}</span>
                <Badge variant="destructive">{p.stock} / seuil {p.seuil_alerte}</Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
