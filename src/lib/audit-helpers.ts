export type AuditRow = {
  id: string;
  user_email: string | null;
  user_id: string | null;
  action: string;
  module: string | null;
  table_name: string;
  record_id: string | null;
  record_ref: string | null;
  occurred_at: string;
  old_values: unknown;
  new_values: unknown;
  changes: unknown;
  ip_address: string | null;
  user_agent: string | null;
  url: string | null;
  http_method: string | null;
  status: string | null;
  status_code?: number | null;
  duration_ms: number | null;
  error_message?: string | null;
  criticite?: "info" | "warning" | "critical" | null;
  session_id?: string | null;
  correlation_id?: string | null;
  city?: string | null;
  country?: string | null;
  country_code?: string | null;
  browser?: string | null;
  browser_version?: string | null;
  os?: string | null;
  device?: string | null;
  screen_resolution?: string | null;
  timezone?: string | null;
};

/** Couleur du badge selon le niveau de criticité. */
export const CRITICITE_STYLE: Record<
  string,
  { label: string; className: string }
> = {
  info: { label: "Info", className: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200" },
  warning: {
    label: "Avertissement",
    className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-200",
  },
  critical: {
    label: "Critique",
    className: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200",
  },
};

/** ISO alpha-2 → emoji drapeau (ex : "CI" → "🇨🇮"). */
export function countryFlag(code?: string | null): string {
  if (!code || code.length !== 2) return "";
  const cc = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return "";
  const A = 0x1f1e6;
  return String.fromCodePoint(A + cc.charCodeAt(0) - 65, A + cc.charCodeAt(1) - 65);
}

export type AuditDiffEntry = {
  champ: string;
  avant: string;
  apres: string;
  kind: "modifie" | "ajoute" | "supprime";
};

function fmtAuditValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/**
 * Résumé lisible des changements entre old_values et new_values :
 * une entrée par champ modifié, ajouté ou supprimé.
 */
export function diffAuditValues(oldValues: unknown, newValues: unknown): AuditDiffEntry[] {
  const oldObj =
    oldValues && typeof oldValues === "object" && !Array.isArray(oldValues)
      ? (oldValues as Record<string, unknown>)
      : {};
  const newObj =
    newValues && typeof newValues === "object" && !Array.isArray(newValues)
      ? (newValues as Record<string, unknown>)
      : {};
  const keys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
  const out: AuditDiffEntry[] = [];
  for (const k of keys) {
    const hasOld = Object.prototype.hasOwnProperty.call(oldObj, k);
    const hasNew = Object.prototype.hasOwnProperty.call(newObj, k);
    const a = oldObj[k];
    const b = newObj[k];
    if (hasOld && hasNew && JSON.stringify(a) === JSON.stringify(b)) continue;
    out.push({
      champ: k,
      avant: hasOld ? fmtAuditValue(a) : "—",
      apres: hasNew ? fmtAuditValue(b) : "—",
      kind: hasOld && hasNew ? "modifie" : hasNew ? "ajoute" : "supprime",
    });
  }
  return out.sort((x, y) => x.champ.localeCompare(y.champ));
}

/** Couleur pour un navigateur donné (badge de la Chronologie / Détail). */
export const BROWSER_STYLE: Record<string, string> = {
  Chrome: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-200",
  Edge: "bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200",
  Firefox: "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-200",
  Safari: "bg-slate-100 text-slate-800 dark:bg-slate-800/60 dark:text-slate-200",
  Opera: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200",
};

/** Couleur du badge résultat succès/erreur/annulé. */
export const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  success: {
    label: "Succès",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
  },
  error: {
    label: "Erreur",
    className: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200",
  },
  cancelled: {
    label: "Annulé",
    className: "bg-slate-100 text-slate-800 dark:bg-slate-800/60 dark:text-slate-200",
  },
};

export const ACTION_LABEL: Record<string, string> = {
  INSERT: "Création",
  UPDATE: "Modification",
  DELETE: "Suppression",
  create_depot: "Création dépôt",
  update_depot: "Modification dépôt",
  delete_depot: "Suppression dépôt",
  ajuster_stock_depot: "Ajustement stock",
  create_approvisionnement: "Approvisionnement",
  create_inventaire_physique: "Création inventaire",
  valider_inventaire_physique: "Validation inventaire",
  regulariser_inventaire: "Régularisation inventaire",
  create_specimen: "Création spécimen",
  cancel_specimen: "Annulation spécimen",
  create_incident_stock: "Création incident",
  cancel_incident_stock: "Annulation incident",
};

export const ACTION_VARIANT = (action: string): "default" | "secondary" | "destructive" => {
  if (action.startsWith("delete") || action.startsWith("cancel") || action === "DELETE")
    return "destructive";
  if (action.startsWith("update") || action === "UPDATE") return "secondary";
  return "default";
};

export const MODULES = [
  { value: "depots", label: "Dépôts" },
  { value: "stocks_depots", label: "Stocks (ajustements)" },
  { value: "inventaires", label: "Inventaires" },
  { value: "achats", label: "Approvisionnements" },
  { value: "incidents", label: "Incidents" },
  { value: "specimens", label: "Spécimens" },
];
