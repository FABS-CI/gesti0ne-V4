// @ts-nocheck — generated RPC type incorrectly forbids the nullable _principal accepted by sec_replace_user_scope.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Moteur de sécurité — Lot 1 : administration des utilisateurs.
 *
 * Toute vérification d'accès passe par `assertGlobalScope` (portée globale =
 * Super Administrateur uniquement). Aucune permission n'est codée en dur
 * ailleurs : les modules métier appellent ces server functions.
 */

const STATUTS = ["actif", "suspendu", "verrouille"] as const;

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
  // RÈGLE ABSOLUE : Pas d'audit pour les actions du Super Admin
  const db = await admin();
  const { data: isSA } = await db.rpc("is_global_scope", { _user_id: actorId });
  if (isSA) return;

  await db.from("rbac2_audit").insert({
    actor_id: actorId,
    action,
    target_type: "user",
    target_id: targetId,
    before: (before ?? null) as never,
    after: (after ?? null) as never,
  });
}

const profileSchema = z.object({
  matricule: z.string().trim().max(40).optional().nullable(),
  nom: z.string().trim().max(80).optional().nullable(),
  prenom: z.string().trim().max(80).optional().nullable(),
  nom_complet: z.string().trim().min(1).max(120),
  telephone: z.string().trim().max(30).optional().nullable(),
  fonction: z.string().trim().max(80).optional().nullable(),
  avatar_url: z.string().trim().max(500).optional().nullable(),
  service_id: z.string().uuid().optional().nullable(),
  departement_id: z.string().uuid().optional().nullable(),
  depot_principal_id: z.string().uuid().optional().nullable(),
});

const scopeSchema = z.object({
  role_codes: z.array(z.string().min(1)).default([]),
  depot_ids: z.array(z.string().uuid()).default([]),
});

// ---------------------------------------------------------------- LIST
export const secListUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertGlobalScope(context.userId);
    const db = await admin();

    const [{ data: profiles, error }, { data: roles }, { data: depots }] = await Promise.all([
      db
        .from("profiles")
        .select(
          "id,email,matricule,nom,prenom,nom_complet,telephone,fonction,avatar_url,statut,locked_at,locked_reason,service_id,departement_id,depot_principal_id,derniere_connexion,created_at",
        )
        .order("nom_complet"),
      db.from("rbac2_user_roles").select("user_id,role_code"),
      db.from("user_depots").select("user_id,depot_id,principal"),
    ]);
    if (error) throw new Error(error.message);

    return (profiles ?? []).map((p) => ({
      ...p,
      role_codes: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role_code),
      depot_ids: (depots ?? []).filter((d) => d.user_id === p.id).map((d) => d.depot_id),
    }));
  });

// ------------------------------------------------------------ REFERENCES
export const secListScopeRefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertGlobalScope(context.userId);
    const db = await admin();
    const [{ data: services }, { data: departements }, { data: depots }, { data: roles }] =
      await Promise.all([
        db.from("services").select("service_id,code,libelle,actif").order("libelle"),
        db.from("departements").select("departement_id,libelle,actif").order("libelle"),
        db.from("depots").select("depot_id,nom,code,actif").order("nom"),
        db.from("rbac2_roles").select("code,label,description,is_system,sort").order("sort"),
      ]);
    return {
      services: services ?? [],
      departements: departements ?? [],
      depots: depots ?? [],
      roles: roles ?? [],
    };
  });

// -------------------------------------------------------------- HELPERS
/** Remplace rôles + dépôts dans une seule transaction SQL (tout ou rien). */
async function syncScope(
  actorId: string,
  userId: string,
  codes: string[],
  depotIds: string[],
  principal?: string | null,
) {
  const db = await admin();
  const { error } = await db.rpc("sec_replace_user_scope", {
    _actor_id: actorId,
    _user_id: userId,
    _role_codes: codes,
    _depot_ids: depotIds,
    _principal: principal ?? null,
  });
  if (error) throw new Error(error.message);
}

// ------------------------------------------------------------- CREATE
export const secCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        email: z.string().trim().toLowerCase().email().max(255),
        password: z.string().min(8).max(128),
        profile: profileSchema,
        scope: scopeSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertGlobalScope(context.userId);
    const db = await admin();

    const { data: created, error: authErr } = await db.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { nom_complet: data.profile.nom_complet },
    });
    if (authErr || !created.user) throw new Error(authErr?.message ?? "Création échouée");
    const uid = created.user.id;

    const { error: profErr } = await db.from("profiles").upsert({
      id: uid,
      email: data.email,
      statut: "actif",
      ...data.profile,
    });
    if (profErr) throw new Error(profErr.message);

    await syncScope(
      context.userId,
      uid,
      data.scope.role_codes,
      data.scope.depot_ids,
      data.profile.depot_principal_id ?? null,
    );
    await audit(context.userId, "user.create", uid, null, {
      email: data.email,
      ...data.profile,
      ...data.scope,
    });

    return { user_id: uid };
  });

// ------------------------------------------------------------- UPDATE
export const secUpdateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        profile: profileSchema,
        scope: scopeSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertGlobalScope(context.userId);
    const db = await admin();

    const { data: before } = await db
      .from("profiles")
      .select("*")
      .eq("id", data.user_id)
      .maybeSingle();

    const { error } = await db
      .from("profiles")
      .update({ ...data.profile, updated_at: new Date().toISOString() })
      .eq("id", data.user_id);
    if (error) throw new Error(error.message);

    await syncScope(
      context.userId,
      data.user_id,
      data.scope.role_codes,
      data.scope.depot_ids,
      data.profile.depot_principal_id ?? null,
    );
    await audit(context.userId, "user.update", data.user_id, before, {
      ...data.profile,
      ...data.scope,
    });

    return { ok: true };
  });

// ------------------------------------------------- STATUT (suspend/lock)
export const secSetUserStatut = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        statut: z.enum(STATUTS),
        reason: z.string().trim().max(300).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertGlobalScope(context.userId);
    if (data.user_id === context.userId && data.statut !== "actif") {
      throw new Error("Vous ne pouvez pas bloquer votre propre compte");
    }
    const db = await admin();

    const { data: before } = await db
      .from("profiles")
      .select("statut,locked_reason")
      .eq("id", data.user_id)
      .maybeSingle();

    const { error } = await db
      .from("profiles")
      .update({
        statut: data.statut,
        locked_reason: data.statut === "actif" ? null : (data.reason ?? null),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.user_id);
    if (error) throw new Error(error.message);

    // Un compte verrouillé perd sa session côté Auth.
    if (data.statut !== "actif") {
      await db.auth.admin.signOut(data.user_id, "global").catch(() => undefined);
    }

    await audit(context.userId, `user.statut.${data.statut}`, data.user_id, before, {
      statut: data.statut,
      reason: data.reason ?? null,
    });
    return { ok: true };
  });

// ----------------------------------------------------- RESET PASSWORD
export const secResetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ user_id: z.string().uuid(), new_password: z.string().min(8).max(128) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertGlobalScope(context.userId);
    const db = await admin();
    const { error } = await db.auth.admin.updateUserById(data.user_id, {
      password: data.new_password,
    });
    if (error) throw new Error(error.message);
    await audit(context.userId, "user.password.reset", data.user_id, null, { reset: true });
    return { ok: true };
  });
