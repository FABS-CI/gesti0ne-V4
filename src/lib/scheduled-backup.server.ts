import { rejectUnlessCronAuthorized } from "./cron-auth.server";

/**
 * Chaîne unique de sauvegarde planifiée : authentification commune puis
 * `orchestrateBackup` (archive ZIP validée en stockage privé, copie Google
 * Drive, rotation, historique). Utilisée par `/api/public/backup/cron` et
 * par l'ancienne adresse `/api/public/hooks/global-backup`.
 */
export async function handleScheduledBackup(request: Request): Promise<Response> {
  const denied = await rejectUnlessCronAuthorized(request);
  if (denied) return denied;

  const { orchestrateBackup } = await import("./backup-orchestrator.server");
  try {
    const result = await orchestrateBackup({
      trigger: "planifie",
      author: "system_cron",
      userId: null,
    });
    return Response.json({
      success: true,
      backupId: result.backupId,
      fileName: result.fileName,
      size: result.size,
    });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
