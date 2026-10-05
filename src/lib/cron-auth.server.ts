import { timingSafeEqual } from "crypto";

/**
 * Secret unique des appels automatiques de sauvegarde.
 *
 * Toutes les routes planifiées (`/api/public/backup/cron`,
 * `/api/public/hooks/global-backup`, `/api/public/hooks/run-schedules`)
 * attendent le même en-tête `x-backup-secret`, comparé en temps constant au
 * jeton unique lu côté serveur. Aucun autre en-tête ni secret de repli.
 */
export const CRON_SECRET_HEADER = "x-backup-secret";

async function readExpectedToken(): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("backup_cron_config")
    .select("token")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.token ?? "";
}

/** Comparaison en temps constant; faux si l'un des deux est vide. */
export function secretsMatch(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Renvoie une réponse 401 si l'appel n'est pas authentifié, sinon `null`. */
export async function rejectUnlessCronAuthorized(request: Request): Promise<Response | null> {
  const provided = request.headers.get(CRON_SECRET_HEADER) ?? "";
  const expected = await readExpectedToken();
  if (secretsMatch(provided, expected)) return null;
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
