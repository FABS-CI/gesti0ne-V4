import { buildGlobalArchive, uploadArchiveToDrive, rotateDriveArchives } from "./global-backup.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyArchive } from "./backup-verify";

/** Bucket privé où sont conservées les archives ZIP (source de restauration). */
export const BACKUP_BUCKET = "erp-backups";
const KEEP_ARCHIVES = 30;
/** Au-delà de ce délai, une sauvegarde « en cours » est considérée bloquée. */
const STALE_MS = 60 * 60 * 1000;

const db = () => supabaseAdmin.from("backups") as any;

/** Marque en échec les sauvegardes restées bloquées « en cours ». */
export async function markStaleBackups() {
  const limit = new Date(Date.now() - STALE_MS).toISOString();
  await db()
    .update({
      statut: "echec",
      finished_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      error_message: "Sauvegarde interrompue (aucune fin enregistrée après 1 h)",
      message: "Sauvegarde interrompue (aucune fin enregistrée après 1 h)",
    })
    .eq("statut", "en_cours")
    .lt("created_at", limit);
}

/** Ne conserve que les N dernières archives dans le bucket. */
async function rotateStorage() {
  const { data: rows } = await db()
    .select("backup_id, storage_path")
    .eq("fichier_disponible", true)
    .not("storage_path", "is", null)
    .order("created_at", { ascending: false })
    .range(KEEP_ARCHIVES, KEEP_ARCHIVES + 500);
  const olds = (rows ?? []) as Array<{ backup_id: string; storage_path: string }>;
  if (!olds.length) return 0;
  await supabaseAdmin.storage.from(BACKUP_BUCKET).remove(olds.map((r) => r.storage_path));
  await db()
    .update({ fichier_disponible: false })
    .in("backup_id", olds.map((r) => r.backup_id));
  return olds.length;
}

export async function orchestrateBackup(opts: {
  trigger: "manuel" | "planifie";
  author: string;
  userId: string | null;
  projectId?: string;
  projectName?: string;
  scope?: "GLOBAL" | "PROJECT";
  runId?: string;
  isTest?: boolean;
}) {
  await markStaleBackups();
  const t0 = Date.now();
  const runId =
    opts.runId ||
    `RUN-${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const triggerType = opts.trigger === "planifie" ? "AUTOMATIC" : "MANUAL";
  const scopeType = opts.scope || (opts.projectId ? "PROJECT" : "GLOBAL");

  const { data: row, error: insertError } = await db()
    .insert({
      user_id: opts.userId,
      user_email: opts.author,
      type: "globale_zip",
      destination: "stockage_prive",
      statut: "en_cours",
      trigger_type: triggerType,
      scope_type: scopeType,
      project_id: opts.projectId || null,
      project_name: opts.projectName || (scopeType === "GLOBAL" ? "Tous les projets" : null),
      run_id: runId,
      is_test: !!opts.isTest,
      fichier_disponible: false,
      message: `Sauvegarde ${opts.isTest ? "de test" : opts.trigger} démarrée…`,
      started_at: new Date().toISOString(),
    })
    .select("backup_id")
    .single();
  if (insertError) throw new Error(`Impossible d'enregistrer la sauvegarde : ${insertError.message}`);
  const backupId = row.backup_id as string;

  try {
    const { bytes, stats } = await buildGlobalArchive(supabaseAdmin, {
      trigger: opts.trigger,
      author: opts.author,
      projectId: opts.projectId,
      projectName: opts.projectName,
    });

    const verification = await verifyArchive(bytes);

    const storagePath = `${new Date().toISOString().slice(0, 7)}/${stats.fileName}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from(BACKUP_BUCKET)
      .upload(storagePath, bytes, { contentType: "application/zip", upsert: true });
    if (upErr) throw new Error(`Stockage de l'archive impossible : ${upErr.message}`);

    // Relecture : le fichier stocké doit exister avec la bonne taille.
    const { data: back, error: dlErr } = await supabaseAdmin.storage.from(BACKUP_BUCKET).download(storagePath);
    if (dlErr || !back) throw new Error(`Relecture de l'archive impossible : ${dlErr?.message ?? "vide"}`);
    if (back.size !== bytes.byteLength)
      throw new Error(`Taille relue incohérente (${back.size} ≠ ${bytes.byteLength})`);

    // Copie secondaire Google Drive (non bloquante).
    let driveInfo: { id: string; url: string | null } | null = null;
    let driveNote = "";
    try {
      driveInfo = await uploadArchiveToDrive(stats.fileName, bytes, `Sauvegarde ${opts.trigger} - SHA256:${stats.sha256}`);
      await rotateDriveArchives(KEEP_ARCHIVES);
    } catch (e) {
      driveNote = ` (copie Google Drive non effectuée : ${(e as Error).message.slice(0, 120)})`;
    }

    await db()
      .update({
        statut: "succes",
        finished_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        duree_ms: Date.now() - t0,
        taille_octets: stats.size,
        nb_tables: stats.tables_count,
        nb_enregistrements: stats.rows_count,
        sha256: stats.sha256,
        fichier_nom: stats.fileName,
        storage_path: storagePath,
        fichier_disponible: true,
        verification,
        destination_ref: driveInfo?.id ?? null,
        destination_url: driveInfo?.url ?? null,
        verifie: true,
        verifie_at: new Date().toISOString(),
        verifie_methode: "zip-integrite+relecture",
        message: `Sauvegarde contrôlée : ${stats.tables_count} tables, ${stats.rows_count} enregistrements, ${stats.users_count} comptes, ${stats.files_embedded}/${stats.files_count} fichiers${stats.files_not_embedded ? ` — AVERTISSEMENT : ${stats.files_not_embedded} fichier(s) non inclus dans l'archive (voir non_embarques du manifeste)` : ""}${driveNote}`,
      })
      .eq("backup_id", backupId);

    await rotateStorage();
    return { backupId, ...stats, storagePath, drive: driveInfo };
  } catch (error) {
    const msg = (error as Error).message;
    await db()
      .update({
        statut: "echec",
        finished_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        duree_ms: Date.now() - t0,
        error_message: msg,
        message: msg,
      })
      .eq("backup_id", backupId);
    throw error;
  }
}
