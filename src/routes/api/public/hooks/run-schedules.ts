import { createFileRoute } from "@tanstack/react-router";
import { rejectUnlessCronAuthorized } from "@/lib/cron-auth.server";

function nextRunFrom(frequence: string, from: Date): Date {
  const d = new Date(from);
  switch ((frequence || "").toLowerCase()) {
    case "horaire":
      d.setHours(d.getHours() + 1);
      break;
    case "hebdomadaire":
      d.setDate(d.getDate() + 7);
      break;
    case "mensuel":
      d.setMonth(d.getMonth() + 1);
      break;
    case "quotidien":
    default:
      d.setDate(d.getDate() + 1);
      break;
  }
  return d;
}

export const Route = createFileRoute("/api/public/hooks/run-schedules")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Secret unique des tâches planifiées (en-tête x-backup-secret).
        const denied = await rejectUnlessCronAuthorized(request);
        if (denied) return denied;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const now = new Date();

        const { data: schedules, error } = await supabaseAdmin
          .from("backup_schedules")
          .select("*")
          .eq("active", true)
          .lte("next_run_at", now.toISOString());

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const processed: Array<{
          schedule_id: string;
          backup_id: string;
          statut: string;
          drive_url?: string | null;
        }> = [];

        for (const s of schedules ?? []) {
          if (!s.created_by) continue;
          // Chaîne unique : archive complète contrôlée en stockage privé (erp-backups).
          const { orchestrateBackup } = await import("@/lib/backup-orchestrator.server");
          let statut: "succes" | "echec" = "succes";
          let backupId = "";
          let driveUrl: string | null = null;
          try {
            const r = await orchestrateBackup({
              trigger: "planifie",
              author: `planification:${s.nom}`,
              userId: s.created_by,
            });
            backupId = r.backupId;
            driveUrl = r.drive?.url ?? null;
          } catch {
            statut = "echec";
          }

          const next = nextRunFrom(s.frequence, now);
          await supabaseAdmin
            .from("backup_schedules")
            .update({ last_run_at: now.toISOString(), next_run_at: next.toISOString() })
            .eq("schedule_id", s.schedule_id);

          if (s.retention_count && s.retention_count > 0) {
            const { data: olds } = await supabaseAdmin
              .from("backups")
              .select("backup_id, storage_path")
              .eq("user_id", s.created_by)
              .order("created_at", { ascending: false })
              .range(s.retention_count, s.retention_count + 500);
            const list = (olds ?? []) as Array<{ backup_id: string; storage_path: string | null }>;
            const ids = list.map((o) => o.backup_id);
            const paths = list.map((o) => o.storage_path).filter((p): p is string => !!p);
            if (paths.length) await supabaseAdmin.storage.from("erp-backups").remove(paths);
            if (ids.length) await supabaseAdmin.from("backups").delete().in("backup_id", ids);
          }

          processed.push({
            schedule_id: s.schedule_id,
            backup_id: backupId,
            statut,
            drive_url: driveUrl,
          });
        }

        // Escalade automatique des approbations dont le SLA est dépassé.
        let escalades = 0;
        try {
          const { data: esc } = await supabaseAdmin.rpc("approbation_escalader_sla");
          escalades = (esc as { escalades?: number } | null)?.escalades ?? 0;
        } catch {
          escalades = 0;
        }

        return new Response(
          JSON.stringify({ ok: true, processed_count: processed.length, processed, escalades }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
