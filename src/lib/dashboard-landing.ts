/**
 * Choix intelligent du tableau de bord d'atterrissage après connexion.
 *
 * Le projet expose 7 dashboards (générique + 6 métier). Sans logique,
 * tout le monde atterrit sur `/dashboard`, alors qu'un magasinier serait
 * plus productif sur `/dashboard-logistique`, un comptable sur
 * `/compta-dashboard`, etc.
 *
 * Ordre de priorité (du plus spécifique au fallback) :
 *  1. Direction / super_admin → `/dashboard` (Centre de pilotage)
 *  2. Logistique  → `/dashboard-logistique`
 *  3. Paie       → `/paie-dashboard`
 *  4. RH         → `/rh-dashboard`
 *  5. Compta     → `/compta-dashboard`
 *  6. Fallback   → `/dashboard`
 */
export type LandingRoute =
  | "/dashboard"
  | "/dashboard-logistique"
  | "/paie-dashboard"
  | "/rh-dashboard"
  | "/compta-dashboard";

export function pickLandingRoute(
  permissions: ReadonlySet<string> | readonly string[] | null | undefined,
  isSuperAdmin = false,
): LandingRoute {
  if (!permissions) return "/dashboard";
  const set = permissions instanceof Set ? permissions : new Set(permissions);
  const has = (k: string) => set.has(k);

  if (isSuperAdmin || has("dashboard_direction.voir") || has("dashboard_global.voir")) {
    return "/dashboard";
  }
  if (has("dashboard_logistique.voir")) return "/dashboard-logistique";
  if (has("paie.voir")) return "/paie-dashboard";
  if (has("dashboard_metier.voir")) return "/rh-dashboard";
  if (has("comptabilite.voir")) return "/compta-dashboard";
  return "/dashboard";
}
