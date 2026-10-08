import { createFileRoute } from "@tanstack/react-router";

import { SecurityDashboard } from "@/components/security/SecurityDashboard";
import { authRouteHead } from "@/lib/route-head";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/admin/securite")({
  head: () => authRouteHead("Tableau de bord sécurité"),
  component: SecuritePage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function SecuritePage() {
  return (
    <div className="container mx-auto space-y-4 p-4 md:p-6">
      <div>
        <h1 className="ds-page-title">Tableau de bord sécurité</h1>
        <p className="text-sm text-muted-foreground">
          Utilisateurs, rôles, permissions, approbations en attente et dernières activités
        </p>
      </div>
      <SecurityDashboard />
    </div>
  );
}
