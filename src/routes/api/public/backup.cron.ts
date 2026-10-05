import { createFileRoute } from "@tanstack/react-router";
import { handleScheduledBackup } from "@/lib/scheduled-backup.server";

/**
 * Sauvegarde automatique (toutes les 3 h via la tâche planifiée « erp-global-backup-3h »).
 * Authentification : en-tête X-Backup-Secret (secret unique, voir cron-auth.server).
 */
export const Route = createFileRoute("/api/public/backup/cron")({
  server: { handlers: { POST: ({ request }) => handleScheduledBackup(request) } },
});
