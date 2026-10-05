import { createFileRoute } from "@tanstack/react-router";
import { handleScheduledBackup } from "@/lib/scheduled-backup.server";

/**
 * Ancienne adresse de la sauvegarde globale, conservée pour compatibilité.
 * Elle exécute désormais exactement la même chaîne que `/api/public/backup/cron`
 * (même secret `x-backup-secret`, même moteur `orchestrateBackup`).
 */
export const Route = createFileRoute("/api/public/hooks/global-backup")({
  server: { handlers: { POST: ({ request }) => handleScheduledBackup(request) } },
});
