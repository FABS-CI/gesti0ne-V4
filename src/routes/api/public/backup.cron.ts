import { createFileRoute } from "@tanstack/react-router";

/**
 * Sauvegarde automatique (toutes les 3 h via la tâche planifiée « erp-global-backup-3h »).
 * Authentification : en-tête X-Backup-Secret comparé au jeton stocké en base
 * (table backup_cron_config, inaccessible aux utilisateurs).
 */
async function handle(request: Request) {
  const provided = request.headers.get("x-backup-secret") ?? "";
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: cfg } = await (supabaseAdmin.from("backup_cron_config") as any)
    .select("token")
    .eq("id", 1)
    .maybeSingle();
  const expected = (cfg?.token as string | undefined) ?? "";
  const enc = new TextEncoder();
  const a = enc.encode(provided);
  const b = enc.encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.min(a.length, b.length); i++) diff |= a[i] ^ b[i];
  if (!expected || diff !== 0) return new Response("Unauthorized", { status: 401 });

  const { orchestrateBackup } = await import("@/lib/backup-orchestrator.server");
  try {
    const result = await orchestrateBackup({ trigger: "planifie", author: "system_cron", userId: null });
    return Response.json({ success: true, backupId: result.backupId, fileName: result.fileName, size: result.size });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/backup/cron")({
  server: { handlers: { GET: ({ request }) => handle(request), POST: ({ request }) => handle(request) } },
});
