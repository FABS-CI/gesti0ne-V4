import { usePermissions } from "@/hooks/use-permissions";
import { filterNavGroupsByPermissions } from "@/lib/rbac-menu-diagnostics";
import { groups, type Group } from "./nav-data";

/**
 * Menu 100 % piloté par la matrice RBAC.
 *
 * Règle unique : un item n'apparaît que si l'utilisateur possède la
 * permission déclarée dans `ROUTE_TO_PERMISSION`.
 *  - `null` (route libre pour tout authentifié) → visible.
 *  - `string` (permission requise) → visible si `has(perm)`.
 *  - `undefined` (route non mappée) → caché (aligné sur `RouteGuard` strict).
 *
 * Aucun rôle codé en dur, aucune exception par email ou libellé de groupe.
 */
export function useVisibleGroups(): Group[] {
  const { permissions, isSuperAdmin, isLoading } = usePermissions();

  // On ne retourne rien tant que les permissions ne sont pas chargées
  // pour éviter un flash de menu vide ou une navigation erronée.
  if (isLoading) return [];

  // Super admin : accès total immédiat
  if (isSuperAdmin) return groups;

  // Filtrage dynamique pour les autres rôles
  const accessible = groups.filter((g) => !g.superAdminOnly);
  const visible = filterNavGroupsByPermissions(permissions, accessible);

  return visible;
}
