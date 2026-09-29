import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AuditActionSchema = z.enum([
  "INSERT",
  "UPDATE",
  "DELETE",
  "LOGIN",
  "LOGIN_FAILED",
  "LOGOUT",
  "EXPORT",
  "IMPORT",
  "PRINT",
  "DOWNLOAD",
  "UPLOAD",
  "VALIDATION",
  "APPROBATION",
  "ANNULATION",
  "CONSULTATION",
]);

const InputSchema = z.object({
  action: AuditActionSchema,
  module: z.string().max(80).optional(),
  table_name: z.string().max(80).optional(),
  record_id: z.string().max(80).optional(),
  record_ref: z.string().max(120).optional(),
  url: z.string().max(2048).optional(),
  http_method: z.string().max(10).optional(),
  status: z.enum(["success", "error", "cancelled"]).default("success"),
  status_code: z.number().int().optional(),
  error_message: z.string().max(1000).optional(),
  duration_ms: z.number().int().nonnegative().max(600_000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  new_values: z.unknown().optional(),
  old_values: z.unknown().optional(),
  // Contexte navigateur envoyé par le client
  session_id: z.string().max(80).optional(),
  correlation_id: z.string().uuid().optional(),
  criticite: z.enum(["info", "warning", "critical"]).default("info"),
  screen_resolution: z.string().max(30).optional(),
  timezone: z.string().max(60).optional(),
});

export type AuditEventInput = z.input<typeof InputSchema>;

/** Simple UA parse côté serveur (mêmes règles que ua-parse.ts). */
function parseUA(ua: string | undefined | null) {
  const s = ua ?? "";
  let os = "";
  if (/Windows NT 10/i.test(s)) os = "Windows 10/11";
  else if (/Windows/i.test(s)) os = "Windows";
  else if (/Android ([\d.]+)/i.test(s)) os = `Android ${RegExp.$1}`;
  else if (/iPhone OS ([\d_]+)/i.test(s)) os = `iOS ${RegExp.$1.replace(/_/g, ".")}`;
  else if (/Mac OS X ([\d_.]+)/i.test(s)) os = `macOS ${RegExp.$1.replace(/_/g, ".")}`;
  else if (/Linux/i.test(s)) os = "Linux";
  let browser = "";
  let bversion = "";
  if (/Edg\/([\d.]+)/i.test(s)) {
    browser = "Edge";
    bversion = RegExp.$1;
  } else if (/OPR\/([\d.]+)/i.test(s)) {
    browser = "Opera";
    bversion = RegExp.$1;
  } else if (/Firefox\/([\d.]+)/i.test(s)) {
    browser = "Firefox";
    bversion = RegExp.$1;
  } else if (/Chrome\/([\d.]+)/i.test(s)) {
    browser = "Chrome";
    bversion = RegExp.$1;
  } else if (/Version\/([\d.]+).*Safari/i.test(s)) {
    browser = "Safari";
    bversion = RegExp.$1;
  }
  let device: "Mobile" | "Tablette" | "Ordinateur" = "Ordinateur";
  if (/iPad|Tablet/i.test(s)) device = "Tablette";
  else if (/Mobile|iPhone|Android/i.test(s)) device = "Mobile";
  return { os, browser, browser_version: bversion, device };
}

/**
 * Écrit un événement enrichi dans le journal d'audit.
 * IP, géolocalisation (Cloudflare), user-agent et parsing navigateur/OS sont
 * capturés automatiquement côté serveur.
 */
export const logAuditEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => InputSchema.parse(raw))
  .handler(async ({ data, context }) => {
    // RÈGLE ABSOLUE : Le Super Administrateur est exempté d'audit.
    // On vérifie le rôle avant toute chose pour éviter l'enregistrement indirect.
    const isSuperAdmin = context.claims?.user_role === "super_admin" || 
                        context.claims?.role === "super_admin";
    
    if (isSuperAdmin) {
      return { id: "skipped_super_admin" };
    }

    let ua: string | undefined;
    let cfCountry: string | undefined;
    let cfCity: string | undefined;
    let cfCountryName: string | undefined;
    let ip: string | undefined;
    try {
      const req = getRequest();
      const h = req.headers;
      const get = (k: string) => h.get(k) ?? undefined;
      ua = get("user-agent");
      cfCountry = get("cf-ipcountry");
      cfCity = get("cf-ipcity");
      cfCountryName = get("cf-ipcountry-name");
      const xff = get("x-forwarded-for");
      ip =
        get("cf-connecting-ip") ??
        get("true-client-ip") ??
        get("x-real-ip") ??
        (xff ? xff.split(",")[0]!.trim() : undefined);
    } catch {
      // pas de contexte requête (rare)
    }
    const parsed = parseUA(ua);

    const { data: id, error } = await context.supabase.rpc("log_audit_event", {
      p_action: data.action,
      p_module: data.module,
      p_table_name: data.table_name,
      p_record_id: data.record_id,
      p_record_ref: data.record_ref,
      p_status: data.status ?? "success",
      p_status_code: data.status_code,
      p_error_message: data.error_message,
      p_duration_ms: data.duration_ms,
      p_metadata: (data.metadata ?? {}) as never,
      p_new_values: (data.new_values ?? null) as never,
      p_old_values: (data.old_values ?? null) as never,
      p_url: data.url,
      p_http_method: data.http_method,
      p_ip: ip,
      p_user_agent: ua,
      p_session_id: data.session_id,
      p_correlation_id: data.correlation_id,
      p_criticite: data.criticite ?? "info",
      p_city: cfCity,
      p_country: cfCountryName ?? cfCountry,
      p_country_code: cfCountry,
      p_browser: parsed.browser || undefined,
      p_browser_version: parsed.browser_version || undefined,
      p_os: parsed.os || undefined,
      p_device: parsed.device,
      p_screen_resolution: data.screen_resolution,
      p_timezone: data.timezone,
    });

    if (error) throw new Error(`audit: ${error.message}`);
    return { id };
  });
