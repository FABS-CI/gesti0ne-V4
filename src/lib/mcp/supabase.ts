/**
 * Client Supabase créé avec le jeton de l'appelant MCP : la RLS et les droits
 * de l'utilisateur s'appliquent (jamais de service_role ici).
 * Les variables d'environnement sont lues à l'appel, jamais à l'import.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";
import type { Database } from "@/integrations/supabase/types";

function env(name: string): string | undefined {
  const p = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return p?.env?.[name]?.trim() || undefined;
}

export class McpAccessError extends Error {}

export async function supabaseForUser(ctx: ToolContext): Promise<SupabaseClient<Database>> {
  const token = ctx.isAuthenticated() ? ctx.getToken() : undefined;
  if (!token) throw new McpAccessError("Non authentifié");
  const url = env("SUPABASE_URL") ?? import.meta.env?.VITE_SUPABASE_URL;
  const key = env("SUPABASE_PUBLISHABLE_KEY") ?? import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL et SUPABASE_PUBLISHABLE_KEY sont requis");
  return createClient<Database>(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Vérifie le droit RBAC v3 de l'appelant avant toute lecture. */
export async function requirePermission(ctx: ToolContext, code: string): Promise<SupabaseClient<Database>> {
  const sb = await supabaseForUser(ctx);
  const { data, error } = await (sb.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>)("rbac3_can", { _perm: code });
  if (error || data !== true) throw new McpAccessError(`Permission refusée : ${code}`);
  return sb;
}
