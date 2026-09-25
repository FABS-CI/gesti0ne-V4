import { useEffect, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { usePermissions } from "@/hooks/use-permissions";
import { getRoutePermission, isSuperAdminOnlyRoute } from "@/lib/route-permissions";
import { logPermissionDenied } from "@/lib/rbac-api";

/**
 * Garde de route RBAC v2. Vérifie que l'utilisateur possède la permission
 * `.voir` associée à la route courante. Redirige vers `/dashboard` (ou
 * `/profil` en dernier recours) avec un toast si l'accès est refusé.
 *
 * Comportement conservateur : une route non mappée passe (fallback autorisé)
 * pour ne rien casser pendant la migration progressive.
 */
export function RouteGuard({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { has, hasAny, isLoading, isSuperAdmin, permissions } = usePermissions();
  const navigate = useNavigate();

  const required = getRoutePermission(pathname);
  const adminOnly = isSuperAdminOnlyRoute(pathname);
  // Fallback strict (batch P1) : une route non mappée est refusée.
  // - `null`  : route explicitement publique (profil, notifications…)
  // - string  : permission requise
  // - undefined : refusé sauf super_admin
  const allowed =
    isSuperAdmin ||
    (!adminOnly &&
      (required === null ||
        (typeof required === "string" && has(required)) ||
        (Array.isArray(required) && hasAny(required))));

  // Diagnostic logs in DEV mode
  useEffect(() => {
    if (import.meta.env.DEV && !isLoading) {
      console.log("[Guard] Path:", pathname, "| Required:", required, "| Allowed:", allowed, "| isSuperAdmin:", isSuperAdmin, "| permsCount:", permissions?.size ?? 0);
    }
  }, [pathname, required, allowed, isSuperAdmin, isLoading]);

  useEffect(() => {
    if (isLoading || allowed) return;
    // Ne pas re-loguer / rediriger si on est déjà sur la page 403.
    if (pathname === "/acces-refuse") return;
    const permLabel = Array.isArray(required) ? required.join("|") : (required ?? "");
    if (required) {
      void logPermissionDenied(permLabel, { path: pathname });
    }
    navigate({
      to: "/acces-refuse",
      search: { perm: permLabel, from: pathname },
      replace: true,
    });
  }, [isLoading, allowed, required, navigate, pathname]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Vérification des accès...</p>
        </div>
      </div>
    );
  }

  if (!allowed) {
    if (import.meta.env.DEV) {
      console.warn("[Guard] Access denied for", pathname, "- Returning null placeholder");
    }
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-sm font-medium text-destructive">Accès restreint</p>
          <p className="text-xs text-muted-foreground mt-1">Vous n'avez pas la permission de voir cette page.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
