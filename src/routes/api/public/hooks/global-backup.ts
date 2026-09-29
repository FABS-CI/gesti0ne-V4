import { createFileRoute } from "@tanstack/react-router";

/**
 * Sauvegarde globale automatique — à appeler toutes les 3 heures
 * (pg_cron ou planificateur externe) :
 *   POST /api/public/hooks/global-backup   (header x-schedule-secret)
 *
 * Construit une archive ZIP unique (données + comptes + fichiers +
 * configuration), l'envoie sur Google Drive, journalise et applique la
 * rotation (30 archives conservées ≈ 3,7 jours d'historique à 3 h).
 */

const MIN_INTERVAL_MS = 3 * 60 * 60 * 1000 - 5 * 60 * 1000; // 3 h (tolérance 5 min)

export const Route = createFileRoute("/api/public/hooks/global-backup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.SCHEDULE_WEBHOOK_SECRET;
        if (!expected) {
          return new Response(JSON.stringify({ error: "Endpoint not configured" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          });
        }

        const provided =
          request.headers.get("x-schedule-secret") ||
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
          request.headers.get("apikey");

        const encoder = new TextEncoder();
        const a = encoder.encode(provided || "");
        const b = encoder.encode(expected);

        if (a.length !== b.length || !crypto.subtle.timingSafeEqual(a, b)) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const url = new URL(request.url);
        const force = url.searchParams.get("force") === "1";

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { buildGlobalArchive, uploadArchiveToDrive, rotateDriveArchives } = await import(
          "@/lib/global-backup.server"
        );

        // Anti-doublon : pas deux archives globales dans la même fenêtre de 3 h.
        if (!force) {
          const { data: last } = await supabaseAdmin
            .from("backups")
            .select("created_at")
            .eq("type", "globale_zip")
            .eq("statut", "succes")
            .order("created_at", { ascending: false })
            .limit(1);
          const lastAt = last?.[0]?.created_at ? new Date(last[0].created_at).getTime() : 0;
          if (lastAt && Date.now() - lastAt < MIN_INTERVAL_MS) {
            return new Response(
              JSON.stringify({ ok: true, skipped: true, reason: "intervalle < 3h" }),
              { headers: { "Content-Type": "application/json" } },
            );
          }
        }

        const t0 = Date.now();
        const { data: row } = await supabaseAdmin
          .from("backups")
          .insert({
            user_email: "cron@system",
            type: "globale_zip",
            destination: "google_drive",
            statut: "en_cours",
            message: "Sauvegarde globale planifiée (toutes les 3 h)",
          })
          .select("backup_id")
          .single();
        const backupId = row?.backup_id as string | undefined;

        try {
          const { bytes, stats } = await buildGlobalArchive(supabaseAdmin, {
            trigger: "planifie",
            author: "cron",
          });
          const drive = await uploadArchiveToDrive(
            stats.fileName,
            bytes,
            `ERP FABS-CI archive globale planifiée sha256=${stats.sha256}`,
          );
          const purged = await rotateDriveArchives(30);

          if (backupId) {
            await supabaseAdmin
              .from("backups")
              .update({
                statut: "succes",
                finished_at: new Date().toISOString(),
                duree_ms: Date.now() - t0,
                taille_octets: stats.size,
                nb_tables: stats.tables_count,
                nb_enregistrements: stats.rows_count,
                sha256: stats.sha256,
                fichier_nom: stats.fileName,
                destination_ref: drive.id,
                destination_url: drive.url,
                verifie: true,
                verifie_at: new Date().toISOString(),
                verifie_methode: "sha256-auto",
                message: `Archive globale planifiée : ${stats.tables_count} tables, ${stats.rows_count} enregistrements, ${stats.users_count} comptes, ${stats.files_embedded}/${stats.files_count} fichiers inclus`,
              })
              .eq("backup_id", backupId);
          }

          return new Response(JSON.stringify({ ok: true, ...stats, drive, purged }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          const message = (e as Error).message;
          if (backupId) {
            await supabaseAdmin
              .from("backups")
              .update({
                statut: "echec",
                finished_at: new Date().toISOString(),
                duree_ms: Date.now() - t0,
                message,
              })
              .eq("backup_id", backupId);
          }
          return new Response(JSON.stringify({ ok: false, error: message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
