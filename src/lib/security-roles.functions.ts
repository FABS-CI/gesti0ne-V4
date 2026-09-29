import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Moteur de sécurité — Lot 2 : rôles et matrice de permissions.
 * Toute écriture exige la portée globale (Super Administrateur).
 */

const STATUTS = ["brouillon", "actif", "archive"] as const;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function assertGlobalScope(userId: string) {
  const db = await admin();
  const { data, error } = await db.rpc("is_global_scope", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Accès réservé au Super Administrateur");
}

async function audit(
  actorId: string,
  action: string,
  targetId: string,
  before: unknown,
  after: unknown,
) {
  const db = await admin();
  await db.from("rbac2_audit").insert({
    actor_id: actorId,
    action,
    target_type: "role",
    target_id: targetId,
    before: (before ?? null) as never,
    after: (after ?? null) as never,
  });
}

// ---------------------------------------------------------------- MATRICE
export const secGetMatrix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertGlobalScope(context.userId);
    const db = await admin();

    const [
      { data: roles, error: rErr },
      { data: permissions, error: pErr },
      { data: rolePerms },
      { data: resources },
      { data: modules },
      { data: userRoles },
    ] = await Promise.all([
      db
        .from("rbac2_roles")
        .select("code,label,description,is_system,sort,statut,valide_at")
        .order("sort"),
      db.from("rbac2_permissions").select("code,resource_code,action,label").order("code"),
      db.from("rbac2_role_perms").select("role_code,perm_code,granted"),
      db.from("rbac2_resources").select("code,module_code,label").order("sort"),
      db.from("rbac2_modules").select("code,label,domain_code,sort").order("sort"),
      db.from("rbac2_user_roles").select("role_code"),
    ]);
    if (rErr) throw new Error(rErr.message);
    if (pErr) throw new Error(pErr.message);

    const resByCode = new Map((resources ?? []).map((r) => [r.code, r]));
    const modByCode = new Map((modules ?? []).map((m) => [m.code, m]));

    const perms = (permissions ?? []).map((p) => {
      const res = resByCode.get(p.resource_code);
      const mod = res ? modByCode.get(res.module_code) : undefined;
      return {
        code: p.code,
        action: p.action,
        label: p.label,
        resource_code: p.resource_code,
        resource_label: res?.label ?? p.resource_code,
        module_code: res?.module_code ?? "_non_classe",
        module_label: mod?.label ?? res?.module_code ?? "Non classé",
      };
    });

    const counts: Record<string, number> = {};
    for (const ur of userRoles ?? []) {
      counts[ur.role_code] = (counts[ur.role_code] ?? 0) + 1;
    }

    return {
      roles: (roles ?? []).map((r) => ({ ...r, users_count: counts[r.code] ?? 0 })),
      permissions: perms,
      grants: (rolePerms ?? [])
        .filter((rp) => rp.granted !== false)
        .map((rp) => `${rp.role_code}::${rp.perm_code}`),
      modules: (modules ?? []).map((m) => ({ code: m.code, label: m.label })),
    };
  });

// ------------------------------------------------------------ TOGGLE PERM
export const secSetRolePerms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        role_code: z.string().min(1),
        perm_codes: z.array(z.string().min(1)).min(1).max(2000),
        granted: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertGlobalScope(context.userId);
    if (data.role_code === "super_admin") {
      throw new Error("Le Super Administrateur conserve toutes les permissions");
    }
    const db = await admin();

    if (data.granted) {
      const { error } = await db
        .from("rbac2_role_perms")
        .upsert(
          data.perm_codes.map((perm_code) => ({
            role_code: data.role_code,
            perm_code,
            granted: true,
          })),
          { onConflict: "role_code,perm_code" },
        );
      if (error) throw new Error(error.message);
    } else {
      const { error } = await db
        .from("rbac2_role_perms")
        .delete()
        .eq("role_code", data.role_code)
        .in("perm_code", data.perm_codes);
      if (error) throw new Error(error.message);
    }

    await audit(context.userId, `role.perms.${data.granted ? "grant" : "revoke"}`, data.role_code, null, {
      count: data.perm_codes.length,
      perms: data.perm_codes.slice(0, 50),
    });
    return { ok: true, count: data.perm_codes.length };
  });

// ------------------------------------------------------------ CREATE ROLE
export const secCreateRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        code: z
          .string()
          .trim()
          .toLowerCase()
          .min(2)
          .max(50)
          .regex(/^[a-z0-9_]+$/, "Code invalide (a-z, 0-9, _)"),
        label: z.string().trim().min(2).max(80),
        description: z.string().trim().max(300).optional().nullable(),
        statut: z.enum(STATUTS).default("brouillon"),
        copy_from: z.string().min(1).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertGlobalScope(context.userId);
    const db = await admin();

    const { data: max } = await db
      .from("rbac2_roles")
      .select("sort")
      .order("sort", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error } = await db.from("rbac2_roles").insert({
      code: data.code,
      label: data.label,
      description: data.description ?? null,
      is_system: false,
      statut: data.statut,
      sort: (max?.sort ?? 0) + 10,
    });
    if (error) throw new Error(error.message);

    if (data.copy_from) {
      const { data: src } = await db
        .from("rbac2_role_perms")
        .select("perm_code,granted")
        .eq("role_code", data.copy_from);
      const rows = (src ?? [])
        .filter((r) => r.granted !== false)
        .map((r) => ({ role_code: data.code, perm_code: r.perm_code, granted: true }));
      if (rows.length > 0) await db.from("rbac2_role_perms").insert(rows);
    }

    await audit(context.userId, "role.create", data.code, null, data);
    return { ok: true, code: data.code };
  });

// ------------------------------------------------------------ UPDATE ROLE
export const secUpdateRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        code: z.string().min(1),
        label: z.string().trim().min(2).max(80),
        description: z.string().trim().max(300).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertGlobalScope(context.userId);
    const db = await admin();

    const { data: before } = await db
      .from("rbac2_roles")
      .select("*")
      .eq("code", data.code)
      .maybeSingle();

    const { error } = await db
      .from("rbac2_roles")
      .update({
        label: data.label,
        description: data.description ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("code", data.code);
    if (error) throw new Error(error.message);

    await audit(context.userId, "role.update", data.code, before, data);
    return { ok: true };
  });

// ----------------------------------------------------------- SET STATUT
export const secSetRoleStatut = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ code: z.string().min(1), statut: z.enum(STATUTS) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertGlobalScope(context.userId);
    if (data.code === "super_admin" && data.statut !== "actif") {
      throw new Error("Le rôle Super Administrateur ne peut pas être désactivé");
    }
    const db = await admin();

    const { data: before } = await db
      .from("rbac2_roles")
      .select("statut")
      .eq("code", data.code)
      .maybeSingle();

    const { error } = await db
      .from("rbac2_roles")
      .update({
        statut: data.statut,
        valide_at: data.statut === "actif" ? new Date().toISOString() : null,
        valide_by: data.statut === "actif" ? context.userId : null,
        updated_at: new Date().toISOString(),
      })
      .eq("code", data.code);
    if (error) throw new Error(error.message);

    await audit(context.userId, `role.statut.${data.statut}`, data.code, before, {
      statut: data.statut,
    });
    return { ok: true };
  });

// ------------------------------------------------------------ DUPLICATE
export const secDuplicateRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        source_code: z.string().min(1),
        code: z
          .string()
          .trim()
          .toLowerCase()
          .min(2)
          .max(50)
          .regex(/^[a-z0-9_]+$/, "Code invalide (a-z, 0-9, _)"),
        label: z.string().trim().min(2).max(80),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertGlobalScope(context.userId);
    const db = await admin();

    const { data: src, error: srcErr } = await db
      .from("rbac2_roles")
      .select("description,sort")
      .eq("code", data.source_code)
      .maybeSingle();
    if (srcErr) throw new Error(srcErr.message);
    if (!src) throw new Error("Rôle source introuvable");

    const { error } = await db.from("rbac2_roles").insert({
      code: data.code,
      label: data.label,
      description: src.description,
      is_system: false,
      statut: "brouillon",
      sort: (src.sort ?? 0) + 1,
    });
    if (error) throw new Error(error.message);

    const { data: perms } = await db
      .from("rbac2_role_perms")
      .select("perm_code,granted")
      .eq("role_code", data.source_code);
    const rows = (perms ?? [])
      .filter((p) => p.granted !== false)
      .map((p) => ({ role_code: data.code, perm_code: p.perm_code, granted: true }));
    if (rows.length > 0) await db.from("rbac2_role_perms").insert(rows);

    await audit(context.userId, "role.duplicate", data.code, { from: data.source_code }, data);
    return { ok: true, code: data.code, perms: rows.length };
  });

// --------------------------------------------------------------- DELETE
export const secDeleteRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ code: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertGlobalScope(context.userId);
    const db = await admin();

    const { data: role } = await db
      .from("rbac2_roles")
      .select("code,label,is_system,statut")
      .eq("code", data.code)
      .maybeSingle();
    if (!role) throw new Error("Rôle introuvable");
    if (role.is_system) throw new Error("Un rôle système ne peut pas être supprimé (archivez-le)");

    const { count } = await db
      .from("rbac2_user_roles")
      .select("user_id", { count: "exact", head: true })
      .eq("role_code", data.code);
    if ((count ?? 0) > 0) {
      throw new Error(`${count} utilisateur(s) portent encore ce rôle : retirez-le d'abord`);
    }

    await db.from("rbac2_role_perms").delete().eq("role_code", data.code);
    const { error } = await db.from("rbac2_roles").delete().eq("code", data.code);
    if (error) throw new Error(error.message);

    await audit(context.userId, "role.delete", data.code, role, null);
    return { ok: true };
  });
