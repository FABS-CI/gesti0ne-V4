import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuperAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("rbac2_user_roles")
    .select("role_code")
    .eq("user_id", userId)
    .eq("role_code", "super_admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Accès réservé au Super Administrateur");
}

const profileFieldsSchema = z.object({
  nom_complet: z.string().trim().min(1).max(120),
  prenom: z.string().trim().max(80).optional().nullable(),
  telephone: z.string().trim().max(30).optional().nullable(),
  fonction: z.string().trim().max(80).optional().nullable(),
  departement: z.string().trim().max(80).optional().nullable(),
  avatar_url: z.string().trim().max(500).optional().nullable(),
  actif: z.boolean().optional(),
});

// ============================================================================
// CREATE
// ============================================================================
export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        email: z.string().trim().toLowerCase().email().max(255),
        password: z.string().min(8).max(128),
        profile: profileFieldsSchema,
        role_ids: z.array(z.string().uuid()).default([]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Crée l'utilisateur auth (email auto-confirmé)
    const { data: created, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        nom_complet: data.profile.nom_complet,
        prenom: data.profile.prenom ?? null,
      },
    });
    if (authErr || !created.user) throw new Error(authErr?.message ?? "Création échouée");
    const newUserId = created.user.id;

    // 2. Upsert profile (le trigger a peut-être créé une ligne minimale)
    const { error: profErr } = await supabaseAdmin.from("profiles").upsert({
      id: newUserId,
      email: data.email,
      nom_complet: data.profile.nom_complet,
      prenom: data.profile.prenom ?? null,
      telephone: data.profile.telephone ?? null,
      fonction: data.profile.fonction ?? null,
      departement: data.profile.departement ?? null,
      avatar_url: data.profile.avatar_url ?? null,
      actif: data.profile.actif ?? true,
    });
    if (profErr) throw new Error(profErr.message);

    // 3. Assignation des rôles RBAC
    if (data.role_ids.length > 0) {
      const rows = data.role_ids.map((role_id) => ({ user_id: newUserId, role_id }));
      const { error: rolesErr } = await supabaseAdmin.from("rbac_user_roles").insert(rows);
      if (rolesErr) throw new Error(rolesErr.message);
    }

    // 4. Audit
    await supabaseAdmin.from("rbac_audit_log").insert({
      user_id: context.userId,
      user_email: data.email,
      action: "user_created",
      details: { cible_user_id: newUserId, roles: data.role_ids },
      apres: {
        email: data.email,
        profile: data.profile,
        role_ids: data.role_ids,
      },
    });

    return { user_id: newUserId };
  });

// ============================================================================
// UPDATE profil
// ============================================================================
export const adminUpdateUserProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        profile: profileFieldsSchema,
        role_ids: z.array(z.string().uuid()).optional(),
        new_password: z.string().min(8).max(128).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Snapshot avant
    const { data: avant } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", data.user_id)
      .maybeSingle();

    // Update profile
    const { error: profErr } = await supabaseAdmin
      .from("profiles")
      .update({
        nom_complet: data.profile.nom_complet,
        prenom: data.profile.prenom ?? null,
        telephone: data.profile.telephone ?? null,
        fonction: data.profile.fonction ?? null,
        departement: data.profile.departement ?? null,
        avatar_url: data.profile.avatar_url ?? null,
        actif: data.profile.actif ?? true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.user_id);
    if (profErr) throw new Error(profErr.message);

    // Update password si fourni
    if (data.new_password) {
      const { error: pwdErr } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
        password: data.new_password,
      });
      if (pwdErr) throw new Error(pwdErr.message);
    }

    // Sync rôles si fourni
    if (data.role_ids) {
      await supabaseAdmin.from("rbac_user_roles").delete().eq("user_id", data.user_id);
      if (data.role_ids.length > 0) {
        const rows = data.role_ids.map((role_id) => ({ user_id: data.user_id, role_id }));
        const { error: rolesErr } = await supabaseAdmin.from("rbac_user_roles").insert(rows);
        if (rolesErr) throw new Error(rolesErr.message);
      }
    }

    await supabaseAdmin.from("rbac_audit_log").insert({
      user_id: context.userId,
      user_email: avant?.email ?? null,
      action: "user_updated",
      details: {
        cible_user_id: data.user_id,
        password_changed: !!data.new_password,
        roles_synced: !!data.role_ids,
      },
      avant: (avant ?? null) as never,
      apres: {
        profile: data.profile,
        role_ids: data.role_ids ?? null,
      } as never,
    });

    return { ok: true };
  });

// ============================================================================
// DELETE (physical deletion via auth admin API)
// FKs on business tables are ON DELETE SET NULL, and created_by_nom fields
// preserve the author name for historical records.
// ============================================================================
export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ user_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    if (data.user_id === context.userId) {
      throw new Error("Vous ne pouvez pas supprimer votre propre compte");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Empêche la suppression d'un autre super_admin
    const { data: isSuper } = await supabaseAdmin
      .from("rbac2_user_roles")
      .select("role_code")
      .eq("user_id", data.user_id)
      .eq("role_code", "super_admin")
      .maybeSingle();
    if (isSuper) throw new Error("Impossible de supprimer un Super Administrateur");

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("email, nom_complet")
      .eq("id", data.user_id)
      .maybeSingle();

    // Révoque les rôles avant suppression (best effort)
    await supabaseAdmin.from("rbac2_user_roles").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("rbac_user_roles").delete().eq("user_id", data.user_id);

    // Suppression physique (cascade sur profiles via FK auth.users)
    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (delErr) throw new Error(delErr.message);

    await supabaseAdmin.from("rbac_audit_log").insert({
      user_id: context.userId,
      user_email: prof?.email ?? null,
      action: "user_deleted",
      details: { cible_user_id: data.user_id, nom_complet: prof?.nom_complet ?? null },
      avant: (prof ?? null) as never,
    });

    return { ok: true };
  });

// ============================================================================
// DEACTIVATE (soft delete)
// ============================================================================
export const adminDeactivateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ user_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    if (data.user_id === context.userId) {
      throw new Error("Vous ne pouvez pas désactiver votre propre compte");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("email, actif")
      .eq("id", data.user_id)
      .maybeSingle();

    await supabaseAdmin
      .from("profiles")
      .update({ actif: false, updated_at: new Date().toISOString() })
      .eq("id", data.user_id);
    await supabaseAdmin.from("rbac2_user_roles").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("rbac_user_roles").delete().eq("user_id", data.user_id);

    await supabaseAdmin.from("rbac_audit_log").insert({
      user_id: context.userId,
      user_email: prof?.email ?? null,
      action: "user_deactivated",
      details: { cible_user_id: data.user_id },
      avant: { actif: prof?.actif ?? null },
      apres: { actif: false, roles_revoked: true },
    });

    return { ok: true };
  });

// ============================================================================
// REACTIVATE
// ============================================================================
export const adminReactivateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        role_ids: z.array(z.string().uuid()).default([]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin
      .from("profiles")
      .update({ actif: true, updated_at: new Date().toISOString() })
      .eq("id", data.user_id);

    if (data.role_ids.length > 0) {
      // Retire d'abord pour éviter les doublons
      await supabaseAdmin
        .from("rbac_user_roles")
        .delete()
        .eq("user_id", data.user_id)
        .in("role_id", data.role_ids);
      const rows = data.role_ids.map((role_id) => ({ user_id: data.user_id, role_id }));
      const { error } = await supabaseAdmin.from("rbac_user_roles").insert(rows);
      if (error) throw new Error(error.message);
    }

    await supabaseAdmin.from("rbac_audit_log").insert({
      user_id: context.userId,
      action: "user_reactivated",
      details: { cible_user_id: data.user_id, role_ids: data.role_ids },
      apres: { actif: true, role_ids: data.role_ids },
    });

    return { ok: true };
  });