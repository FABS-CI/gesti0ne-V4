// @ts-nocheck — schema temporarily reduced after reset; types.ts regenerates when tables come back.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ADMIN_ROLES = ["super_admin", "directeur_general", "secretariat"] as const;
type AdminRole = (typeof ADMIN_ROLES)[number];

async function assertRhAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("rbac2_user_roles")
    .select("role_code")
    .eq("user_id", userId)
    .in("role_code", ADMIN_ROLES as unknown as AdminRole[]);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Accès réservé à l'administration RH");
  }
}

async function loadEmploye(employeId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("employes")
    .select("employe_id, nom_complet, email, user_id, actif")
    .eq("employe_id", employeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Employé introuvable");
  return data;
}

/** Statut du compte utilisateur lié à l'employé. */
export const getEmployeAccountStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ employeId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertRhAdmin(context.userId);
    const emp = await loadEmploye(data.employeId);
    if (!emp.user_id) {
      return { hasAccount: false as const, employe: emp };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: userRes, error } = await supabaseAdmin.auth.admin.getUserById(emp.user_id);
    if (error) throw new Error(error.message);
    const u = userRes.user;
    const { data: roles } = await supabaseAdmin
      .from("rbac2_user_roles")
      .select("role_code")
      .eq("user_id", emp.user_id);
    return {
      hasAccount: true as const,
      employe: emp,
      account: {
        id: u?.id,
        email: u?.email ?? null,
        last_sign_in_at: u?.last_sign_in_at ?? null,
        created_at: u?.created_at ?? null,
        banned_until: (u as unknown as { banned_until?: string | null })?.banned_until ?? null,
        email_confirmed_at: u?.email_confirmed_at ?? null,
      },
      roles: (roles ?? []).map((r) => r.role_code),
    };
  });

/** Crée un compte utilisateur pour l'employé et envoie une invitation par email. */
export const createEmployeAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        employeId: z.string().uuid(),
        email: z.string().email(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertRhAdmin(context.userId);
    const emp = await loadEmploye(data.employeId);
    if (emp.user_id) throw new Error("Un compte est déjà rattaché à cet employé");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv, error: invErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      data.email,
      { data: { nom_complet: emp.nom_complet, employe_id: emp.employe_id } },
    );
    if (invErr) throw new Error(invErr.message);
    const newUserId = inv.user?.id;
    if (!newUserId) throw new Error("Impossible de créer le compte");

    const { error: upErr } = await supabaseAdmin
      .from("employes")
      .update({ user_id: newUserId, email: data.email })
      .eq("employe_id", data.employeId);
    if (upErr) throw new Error(upErr.message);

    return { ok: true, userId: newUserId };
  });

/** Envoie un lien de réinitialisation de mot de passe. */
export const resetEmployePassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ employeId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertRhAdmin(context.userId);
    const emp = await loadEmploye(data.employeId);
    if (!emp.user_id || !emp.email) throw new Error("Aucun compte lié à cet employé");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: emp.email,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Active ou désactive le compte utilisateur (ban indéfini / unban). */
export const setEmployeAccountBan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ employeId: z.string().uuid(), banned: z.boolean() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertRhAdmin(context.userId);
    const emp = await loadEmploye(data.employeId);
    if (!emp.user_id) throw new Error("Aucun compte lié à cet employé");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(emp.user_id, {
      ban_duration: data.banned ? "876000h" : "none",
    } as unknown as { ban_duration: string });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Détache le compte utilisateur de la fiche employé (sans supprimer le compte auth). */
export const detachEmployeAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ employeId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertRhAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("employes")
      .update({ user_id: null })
      .eq("employe_id", data.employeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// Historique d'audit
// ============================================================

import type { Json } from "@/integrations/supabase/types";

export type EmployeAuditEntry = {
  id: string;
  occurred_at: string;
  action: string;
  status: string;
  module: string | null;
  table_name: string | null;
  user_email: string | null;
  ip_address: string | null;
  changes: Json | null;
  error_message: string | null;
};

export const getEmployeAuditHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        employeId: z.string().uuid(),
        limit: z.number().int().min(1).max(200).default(100),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertRhAdmin(context.userId);
    const emp = await loadEmploye(data.employeId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const orFilters = [`record_id.eq.${data.employeId}`];
    if (emp.user_id) orFilters.push(`user_id.eq.${emp.user_id}`);

    const { data: rows, error } = await supabaseAdmin
      .from("audit_events")
      .select(
        "id, occurred_at, action, status, module, table_name, user_email, ip_address, changes, error_message",
      )
      .or(orFilters.join(","))
      .order("occurred_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);

    return (rows ?? []).map((r) => ({
      ...r,
      ip_address: r.ip_address ? String(r.ip_address) : null,
    })) as EmployeAuditEntry[];
  });