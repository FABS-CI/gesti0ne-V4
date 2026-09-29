import { createFileRoute } from "@tanstack/react-router";
import { getOrCreateBackupFolder } from "@/lib/gdrive-folder";

const TABLES = [
  "clients",
  "produits",
  "commandes",
  "commande_lignes",
  "transactions",
  "factures",
  "paiements",
  "fournisseurs",
  "achats",
  "employes",
  "conges",
  "stock_mouvements",
];

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

async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function uploadJsonToDrive(fileName: string, json: string, description: string) {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const GDRIVE_KEY = process.env.GOOGLE_DRIVE_API_KEY;
  if (!LOVABLE_API_KEY || !GDRIVE_KEY) {
    throw new Error("Connecteur Google Drive non configuré");
  }
  const folderId = await getOrCreateBackupFolder(LOVABLE_API_KEY, GDRIVE_KEY);
  if (!folderId) {
    throw new Error("Dossier « DONNEE GESTI-ONE » introuvable — upload annulé");
  }
  const boundary = `----lovable-${crypto.randomUUID()}`;
  const meta = { name: fileName, mimeType: "application/json", description, parents: [folderId] };
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(meta) +
    `\r\n--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    json +
    `\r\n--${boundary}--`;

  const res = await fetch(
    "https://connector-gateway.lovable.dev/google_drive/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GDRIVE_KEY,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  if (!res.ok) throw new Error(`Drive upload ${res.status}: ${await res.text()}`);
  return (await res.json()) as { id: string; name: string; webViewLink?: string };
}

export const Route = createFileRoute("/api/public/hooks/run-schedules")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Authorize: either shared secret (legacy) or Supabase anon apikey (pg_cron pattern)
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
          const t0 = Date.now();
          const { data: backup, error: insErr } = await supabaseAdmin
            .from("backups")
            .insert({
              user_id: s.created_by,
              user_email: "cron@system",
              type: s.type_sauvegarde ?? "complete",
              destination: s.destination ?? "local",
              statut: "en_cours",
              message: `Sauvegarde planifiée « ${s.nom} »`,
              scope: { tables: TABLES, schedule_id: s.schedule_id },
            })
            .select("backup_id")
            .single();
          if (insErr || !backup) continue;
          const backupId = backup.backup_id as string;

          let statut: "succes" | "echec" = "succes";
          let driveUrl: string | null = null;
          let msg: string | null = null;
          let totalRows = 0;
          let size = 0;
          let sha: string | null = null;
          let fileName: string | null = null;

          try {
            const dump: Record<string, unknown[]> = {};
            for (const t of TABLES) {
              const { data, error: e } = await supabaseAdmin
                .from(t as never)
                .select("*");
              if (e) throw new Error(`${t}: ${e.message}`);
              dump[t] = (data ?? []) as unknown[];
              totalRows += dump[t].length;
            }
            const json = JSON.stringify(dump);
            size = new TextEncoder().encode(json).length;
            sha = await sha256Hex(json);
            fileName = `backup_fabs_${now.toISOString().slice(0, 10)}_${backupId.slice(0, 8)}.json`;

            if ((s.destination ?? "local") === "google_drive") {
              const info = await uploadJsonToDrive(
                fileName,
                json,
                `ERP FABS-CI backup ${backupId} sha256=${sha}`,
              );
              driveUrl = info.webViewLink ?? null;
              await supabaseAdmin
                .from("backups")
                .update({ destination_ref: info.id, destination_url: driveUrl })
                .eq("backup_id", backupId);
            }
          } catch (e) {
            statut = "echec";
            msg = (e as Error).message;
          }

          await supabaseAdmin
            .from("backups")
            .update({
              statut,
              finished_at: new Date().toISOString(),
              duree_ms: Date.now() - t0,
              taille_octets: size || null,
              nb_tables: TABLES.length,
              nb_enregistrements: totalRows,
              sha256: sha,
              fichier_nom: fileName,
              verifie: statut === "succes",
              verifie_at: statut === "succes" ? new Date().toISOString() : null,
              verifie_methode: statut === "succes" ? "sha256-auto" : null,
              message: msg,
            })
            .eq("backup_id", backupId);

          const next = nextRunFrom(s.frequence, now);
          await supabaseAdmin
            .from("backup_schedules")
            .update({ last_run_at: now.toISOString(), next_run_at: next.toISOString() })
            .eq("schedule_id", s.schedule_id);

          if (s.retention_count && s.retention_count > 0) {
            const { data: olds } = await supabaseAdmin
              .from("backups")
              .select("backup_id")
              .eq("user_id", s.created_by)
              .order("created_at", { ascending: false })
              .range(s.retention_count, s.retention_count + 500);
            const ids = (olds ?? []).map((o: { backup_id: string }) => o.backup_id);
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
