import { supabase } from "@/integrations/supabase/client";

// ---------- Types ----------

export type RbacRole = {
  role_id: string;
  code: string;
  libelle: string;
  description: string | null;
  actif: boolean;
  systeme: boolean;
  hierite_de: string | null;
  created_at: string;
  updated_at: string;
};

export type RbacPermission = {
  code: string;
  module: string;
  sous_module: string | null;
  action: string;
  libelle: string;
  description: string | null;
};

export type RbacRolePermission = {
  role_id: string;
  permission_code: string;
  accorde: boolean;
};

export type RbacAuditRow = {
  id: string;
  created_at: string;
  user_id: string | null;
  user_email: string | null;
  role_id: string | null;
  role_code: string | null;
  action: string;
  details: Record<string, unknown> | null;
  ip?: string | null;
  user_agent?: string | null;
  avant?: Record<string, unknown> | null;
  apres?: Record<string, unknown> | null;
};

export type UserProfile = {
  id: string;
  email: string | null;
  nom_complet: string | null;
  actif: boolean;
  prenom?: string | null;
  telephone?: string | null;
  fonction?: string | null;
  departement?: string | null;
  avatar_url?: string | null;
};

export type UserRoleAssignment = {
  user_id: string;
  role_id: string;
};

async function selectAllPages<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
): Promise<T[]> {
  const PAGE_SIZE = 1000;
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await buildQuery(from, to);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...(page as T[]));
    if (page.length < PAGE_SIZE) return rows;
  }
}

// ---------- Rôles ----------

export async function listRoles(): Promise<RbacRole[]> {
  const { data, error } = await supabase
    .from("rbac_roles")
    .select("*")
    .order("systeme", { ascending: false })
    .order("libelle");
  if (error) throw error;
  return (data ?? []) as RbacRole[];
}

export async function createRole(payload: {
  code: string;
  libelle: string;
  description?: string | null;
  hierite_de?: string | null;
}): Promise<RbacRole> {
  await assertPermission("roles_permissions.creer_role");
  const { data, error } = await supabase
    .from("rbac_roles")
    .insert({ ...payload, systeme: false, actif: true })
    .select("*")
    .single();
  if (error) throw error;
  return data as RbacRole;
}

export async function updateRole(
  roleId: string,
  patch: Partial<Pick<RbacRole, "libelle" | "description" | "actif" | "hierite_de">>,
): Promise<void> {
  await assertPermission("roles_permissions.modifier_role");
  const { error } = await supabase.from("rbac_roles").update(patch).eq("role_id", roleId);
  if (error) throw error;
}

export async function deleteRole(roleId: string): Promise<void> {
  await assertPermission("roles_permissions.supprimer_role");
  const { error } = await supabase.from("rbac_roles").delete().eq("role_id", roleId);
  if (error) throw error;
}

// ---------- Permissions ----------

export async function listPermissions(): Promise<RbacPermission[]> {
  return selectAllPages<RbacPermission>((from, to) =>
    supabase
      .from("rbac_permissions")
      .select("*")
      .order("module")
      .order("sous_module")
      .order("action")
      .range(from, to) as never,
  );
}

export async function listRolePermissions(roleId: string): Promise<RbacRolePermission[]> {
  return selectAllPages<RbacRolePermission>((from, to) =>
    supabase
      .from("rbac_role_permissions")
      .select("*")
      .eq("role_id", roleId)
      .order("permission_code")
      .range(from, to) as never,
  );
}

export async function setRolePermission(
  roleId: string,
  permissionCode: string,
  accorde: boolean,
): Promise<void> {
  // Même chemin serveur que le bulk : transaction atomique + assert_permission
  // côté RPC, donc pas de pré-check client redondant ni d'écriture directe.
  const { error } = await supabase.rpc("rbac_set_role_permission", {
    _role_id: roleId,
    _code: permissionCode,
    _accorde: accorde,
  });
  if (error) throw error;
}

export async function bulkSetRolePermissions(
  roleId: string,
  codes: string[],
  accorde: boolean,
): Promise<void> {
  if (codes.length === 0) return;

  // Atomicité serveur : un seul appel RPC transactionnel remplace
  // les 36 aller-retour précédents (chunks de 50). Voir migration
  // `rbac_bulk_set_permissions`. Le contrôle d'accès
  // (`roles_permissions.assigner_permission`) est fait côté RPC.
  const { error } = await supabase.rpc("rbac_bulk_set_permissions", {
    _role_id: roleId,
    _codes: codes,
    _accorde: accorde,
  });
  if (error) throw error;
}

// (Ancien helper orderPermissionsForGrant retiré : le RPC atomique
// `rbac_bulk_set_permissions` ne dépend plus d'un ordre d'insertion,
// et aucun trigger de cohérence "voir requis" n'est actif en base.)

export async function copyRolePermissions(fromRoleId: string, toRoleId: string): Promise<void> {
  await assertPermission("roles_permissions.assigner_permission");
  const src = await listRolePermissions(fromRoleId);
  if (src.length === 0) return;
  const rows = src.map((r) => ({
    role_id: toRoleId,
    permission_code: r.permission_code,
    accorde: r.accorde,
  }));
  const { error } = await supabase
    .from("rbac_role_permissions")
    .upsert(rows, { onConflict: "role_id,permission_code" });
  if (error) throw error;
}

/**
 * Duplique un rôle existant : crée un nouveau rôle (non système, actif)
 * dont les permissions sont copiées depuis le rôle source.
 * Le lien d'héritage (`hierite_de`) est également repris.
 */
export async function duplicateRole(
  sourceRoleId: string,
  newCode: string,
  newLibelle: string,
): Promise<RbacRole> {
  await assertPermission("roles_permissions.dupliquer_role");
  const { data: src, error: e1 } = await supabase
    .from("rbac_roles")
    .select("description, hierite_de")
    .eq("role_id", sourceRoleId)
    .single();
  if (e1) throw e1;

  const created = await createRole({
    code: newCode,
    libelle: newLibelle,
    description: src?.description ?? null,
    hierite_de: src?.hierite_de ?? null,
  });

  await copyRolePermissions(sourceRoleId, created.role_id);
  return created;
}

// ---------- Utilisateurs ----------

export async function listUserProfiles(): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, nom_complet, actif, prenom, telephone, fonction, departement, avatar_url")
    .order("nom_complet", { nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as UserProfile[];
}

export async function listUserRoleAssignments(): Promise<UserRoleAssignment[]> {
  const { data, error } = await supabase.from("rbac_user_roles").select("user_id, role_id");
  if (error) throw error;
  return (data ?? []) as UserRoleAssignment[];
}

export async function assignRoleToUser(userId: string, roleId: string): Promise<void> {
  await assertPermission("roles_permissions.assigner_role_utilisateur");
  const { error } = await supabase
    .from("rbac_user_roles")
    .upsert({ user_id: userId, role_id: roleId }, { onConflict: "user_id,role_id" });
  if (error) throw error;
}

export async function revokeRoleFromUser(userId: string, roleId: string): Promise<void> {
  await assertPermission("utilisateurs.revoquer_role");
  const { error } = await supabase
    .from("rbac_user_roles")
    .delete()
    .eq("user_id", userId)
    .eq("role_id", roleId);
  if (error) throw error;
}

// ---------- Audit ----------

export async function listAuditLog(limit = 200): Promise<RbacAuditRow[]> {
  const { data, error } = await supabase
    .from("rbac_audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as RbacAuditRow[];
}

// ---------- Enforcement (pré-check client) ----------

/**
 * Pré-check RBAC v2 avant une mutation sensible.
 *
 * Appelle la fonction SQL `assert_permission(_perm)` qui lève une erreur
 * si l'utilisateur courant n'a pas la permission. À combiner avec RLS
 * côté DB pour un enforcement complet — ici on donne un feedback immédiat
 * à l'UI plutôt qu'un 42501 opaque.
 */
export async function assertPermission(perm: string): Promise<void> {
  const { error } = await supabase.rpc("assert_permission", { _perm: perm });
  if (error) {
    const err = new Error(`Permission refusée : ${perm}`);
    (err as Error & { kind?: string; permission?: string }).kind = "rbac";
    (err as Error & { kind?: string; permission?: string }).permission = perm;
    throw err;
  }
}

/**
 * Classifie une erreur remontée par une RPC / mutation Supabase afin
 * d'afficher un message clair distinguant :
 *  - `rbac`     → l'utilisateur n'a pas la permission (Matrice RBAC)
 *  - `business` → l'action est refusée par une règle métier (ex. inventaire déjà validé)
 *  - `auth`     → l'utilisateur n'est pas authentifié
 *  - `unknown`  → tout le reste (réseau, timeout, bug…)
 *
 * À utiliser dans les handlers de toast pour préfixer le message :
 *   const d = describeSupabaseError(err);
 *   toast.error(d.title, { description: d.message });
 */
export type SupabaseErrorKind = "rbac" | "business" | "auth" | "unknown";

export function describeSupabaseError(error: unknown): {
  kind: SupabaseErrorKind;
  title: string;
  message: string;
} {
  const raw =
    (error as { message?: string })?.message ??
    (typeof error === "string" ? error : "") ??
    "";
  const code = (error as { code?: string })?.code;

  // 1) Auth
  if (code === "28000" || /non authentifi[ée]/i.test(raw)) {
    return { kind: "auth", title: "Non authentifié", message: raw || "Session expirée." };
  }

  // 2) RBAC — assert_permission côté SQL (ERRCODE 42501) ou message client
  if (
    code === "42501" ||
    /permission refus[ée]e/i.test(raw) ||
    (error as { kind?: string })?.kind === "rbac"
  ) {
    const perm =
      (error as { permission?: string })?.permission ??
      raw.match(/permission refus[ée]e\s*:\s*([\w.]+)/i)?.[1];
    return {
      kind: "rbac",
      title: "Permission refusée",
      message: perm
        ? `Vous n'avez pas la permission « ${perm} ». Contactez un administrateur.`
        : raw || "Vous n'avez pas les droits nécessaires.",
    };
  }

  // 3) Règle métier — messages levés par RAISE EXCEPTION dans les RPC
  //    (interdit, déjà, impossible, non autorisé…)
  if (/(interdit|d[ée]j[àa]\s|impossible|non\s+autoris[ée]|invalide|verrouill[ée])/i.test(raw)) {
    return { kind: "business", title: "Règle métier", message: raw };
  }

  return { kind: "unknown", title: "Erreur", message: raw || "La demande a été refusée sans cause précise. Réessayez, puis contactez un administrateur si le problème persiste." };
}

/**
 * Enregistre un refus détecté côté client (RouteGuard) dans le journal RBAC.
 * Fire-and-forget : ne bloque jamais la navigation même en cas d'erreur réseau.
 */
export async function logPermissionDenied(
  perm: string,
  context: Record<string, unknown> = {},
): Promise<void> {
  try {
    await supabase.rpc("log_permission_denied", {
      _perm: perm,
      _context: context as never,
    });
  } catch {
    /* silencieux — l'audit ne doit pas casser l'UX */
  }
}
