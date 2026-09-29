import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const APP_ROLES = [
  "super_admin",
  "directeur_general",
  "comptable",
  "directeur_commercial",
  "gestionnaire_stock",
  "responsable_magasinier",
  "secretariat",
  "assistante",
  "assistante_comptable",
  "service_logistique",
] as const;

async function assertSuperAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("rbac2_user_roles")
    .select("role_code")
    .eq("user_id", userId)
    .eq("role_code", "super_admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Accès réservé au super administrateur");
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profiles, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, email, nom_complet, actif, created_at")
      .order("created_at", { ascending: false });
    if (pErr) throw new Error(pErr.message);

    const { data: roles, error: rErr } = await supabaseAdmin
      .from("rbac2_user_roles")
      .select("user_id, role_code");
    if (rErr) throw new Error(rErr.message);

    const rolesByUser = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role_code);
      rolesByUser.set(r.user_id, arr);
    }

    return (profiles ?? []).map((p) => ({
      ...p,
      roles: rolesByUser.get(p.id) ?? [],
    }));
  });

/**
 * Liste enrichie pour la mise en production : ajoute la dernière connexion,
 * l'état de confirmation d'e-mail et l'identifiant de connexion.
 */
export const listUsersForProduction = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profiles, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, email, nom_complet, actif, created_at")
      .order("nom_complet", { ascending: true });
    if (pErr) throw new Error(pErr.message);

    const { data: roles } = await supabaseAdmin
      .from("rbac2_user_roles")
      .select("user_id, role_code");
    const rolesByUser = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role_code);
      rolesByUser.set(r.user_id, arr);
    }

    // Enrichit avec les infos d'authentification (dernière connexion, confirmation).
    const authInfo = new Map<string, { last_sign_in_at: string | null; confirmed: boolean }>();
    let page = 1;
    const perPage = 200;
    for (;;) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (error) break;
      for (const u of data.users) {
        authInfo.set(u.id, {
          last_sign_in_at: u.last_sign_in_at ?? null,
          confirmed: !!u.email_confirmed_at || !!u.confirmed_at,
        });
      }
      if (data.users.length < perPage) break;
      page += 1;
      if (page > 50) break;
    }

    return (profiles ?? []).map((p) => {
      const a = authInfo.get(p.id);
      return {
        id: p.id,
        email: p.email,
        login: p.email,
        nom_complet: p.nom_complet,
        actif: p.actif,
        created_at: p.created_at,
        roles: rolesByUser.get(p.id) ?? [],
        last_sign_in_at: a?.last_sign_in_at ?? null,
        confirmed: a?.confirmed ?? false,
      };
    });
  });

/**
 * Génère un lien de réinitialisation de mot de passe pour un utilisateur.
 * Les mots de passe étant hachés, ils ne peuvent jamais être affichés ;
 * on distribue à la place un lien de récupération.
 */
export const generatePasswordResetLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ email: z.string().email() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: data.email,
    });
    if (error) throw new Error(error.message);
    return {
      action_link: link.properties?.action_link ?? null,
      email_otp: link.properties?.email_otp ?? null,
    };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(APP_ROLES),
        action: z.enum(["add", "remove"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.action === "add") {
      const { error } = await supabaseAdmin
        .from("rbac2_user_roles")
        .insert({ user_id: data.userId, role_code: data.role, granted_by: context.userId });
      if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("rbac2_user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role_code", data.role);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/** Crée un nouvel utilisateur (Auth + profile) et lui affecte des rôles. */
export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        password: z.string().min(8).max(128),
        nom_complet: z.string().trim().min(1).max(120),
        roles: z.array(z.enum(APP_ROLES)).default([]),
        actif: z.boolean().default(true),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { nom_complet: data.nom_complet },
    });
    if (cErr || !created.user) throw new Error(cErr?.message || "Création échouée");
    const uid = created.user.id;

    const { error: pErr } = await supabaseAdmin
      .from("profiles")
      .upsert(
        { id: uid, email: data.email, nom_complet: data.nom_complet, actif: data.actif },
        { onConflict: "id" },
      );
    if (pErr) throw new Error(pErr.message);

    if (data.roles.length > 0) {
      const rows = data.roles.map((r) => ({
        user_id: uid,
        role_code: r,
        granted_by: context.userId,
      }));
      const { error: rErr } = await supabaseAdmin.from("rbac2_user_roles").insert(rows);
      if (rErr && !rErr.message.includes("duplicate")) throw new Error(rErr.message);
    }
    return { ok: true, userId: uid };
  });

/** Met à jour le nom / email d'un utilisateur. */
export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        userId: z.string().uuid(),
        nom_complet: z.string().trim().min(1).max(120).optional(),
        email: z.string().trim().email().max(255).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.email) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
        email: data.email,
      });
      if (error) throw new Error(error.message);
    }
    const patch: { nom_complet?: string; email?: string } = {};
    if (data.nom_complet !== undefined) patch.nom_complet = data.nom_complet;
    if (data.email !== undefined) patch.email = data.email;
    if (Object.keys(patch).length > 0) {
      const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", data.userId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/** Suspend (désactive) ou réactive un compte utilisateur. */
export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ userId: z.string().uuid(), actif: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    if (data.userId === context.userId && !data.actif) {
      throw new Error("Vous ne pouvez pas suspendre votre propre compte");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: aErr } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.actif ? "none" : "876000h",
    });
    if (aErr) throw new Error(aErr.message);

    const { error: pErr } = await supabaseAdmin
      .from("profiles")
      .update({ actif: data.actif })
      .eq("id", data.userId);
    if (pErr) throw new Error(pErr.message);
    return { ok: true };
  });