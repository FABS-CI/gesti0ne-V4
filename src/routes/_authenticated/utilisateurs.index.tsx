import { createFileRoute } from "@tanstack/react-router";
import { UsersAdmin } from "@/components/security/UsersAdmin";

import { authRouteHead } from "@/lib/route-head";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
export const Route = createFileRoute("/_authenticated/utilisateurs/")({
  head: () => authRouteHead("Utilisateurs"),
  component: UtilisateursPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function UtilisateursPage() {
  return (
    <div className="container mx-auto space-y-4 p-4 md:p-6">
      <div>
        <h1 className="ds-page-title">Utilisateurs</h1>
        <p className="text-sm text-muted-foreground">
          Comptes, périmètre (service, département, dépôts), rôles et statut d'activation
        </p>
      </div>
      <UsersAdmin />
    </div>
  );
}
