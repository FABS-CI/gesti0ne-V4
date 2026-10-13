import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sha256Hex, sortTablesByDependencies } from "./backup-verify";

export const RESTORE_CONFIRMATION = "RESTAURER";

export type RestoreReport = {
  dry_run: boolean;
  fileName: string;
  sha256_ok: boolean | null;
  pre_backup_id: string | null;
  tables: Array<{ table: string; lignes_archive: number; lignes_base: number | null; difference: number | null }>;
  restored_tables: string[];
  users: { succes: number; echecs: number };
  files: number;
  errors: string[];
  stopped_at: string | null;
};

/**
 * Restauration : simulation par défaut (aucune écriture). La restauration
 * réelle exige dryRun=false + confirmation « RESTAURER », lance d'abord une
 * sauvegarde de sécurité, suit l'ordre des clés étrangères et s'arrête à la
 * première erreur.
 */
export async function orchestrateRestore(opts: {
  backupId?: string;
  base64?: string;
  fileName?: string;
  userId: string;
  dryRun?: boolean;
  confirmation?: string;
}): Promise<RestoreReport> {
  const dryRun = opts.dryRun !== false;
  if (!dryRun && opts.confirmation !== RESTORE_CONFIRMATION)
    throw new Error(`Confirmation manquante : saisissez « ${RESTORE_CONFIRMATION} »`);

  const JSZip = (await import("jszip")).default;
  let bytes: Uint8Array | null = null;
  let fileName = opts.fileName || "restoration.zip";
  let shaOk: boolean | null = null;

  if (opts.base64) {
    const bin = atob(opts.base64);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } else if (opts.backupId) {
    const { data: backup } = await supabaseAdmin
      .from("backups")
      .select("*")
      .eq("backup_id", opts.backupId)
      .single();
    if (!backup) throw new Error("Sauvegarde introuvable dans l'historique");
    const b = backup as any;
    if (b.storage_path && b.fichier_disponible) {
      const { data: blob, error } = await supabaseAdmin.storage.from("erp-backups").download(b.storage_path);
      if (error || !blob) throw new Error(`Archive introuvable dans le stockage : ${error?.message ?? ""}`);
      bytes = new Uint8Array(await blob.arrayBuffer());
    } else if (b.destination_ref && b.destination_ref !== "local_only") {
      const { downloadDriveFileRaw } = await import("./gdrive-download.server");
      bytes = await downloadDriveFileRaw(b.destination_ref);
    } else {
      throw new Error("Fichier de sauvegarde inaccessible (ni stockage privé ni Google Drive)");
    }
    fileName = b.fichier_nom || fileName;
    if (!b.sha256) throw new Error("Empreinte SHA-256 absente de l'historique : restauration refusée");
    const actual = await sha256Hex(bytes);
    if (actual !== b.sha256)
      throw new Error("Empreinte SHA-256 différente de celle enregistrée : archive altérée, restauration refusée");
    shaOk = true;
  }
  if (!bytes) throw new Error("Aucune source de données valide pour la restauration");

  const zip = await JSZip.loadAsync(bytes);
  if (!zip.file("MANIFEST.json")) throw new Error("Archive invalide : MANIFEST.json manquant");

  const tableNames = Object.keys(zip.files)
    .filter((f) => f.startsWith("data/") && f.endsWith(".json"))
    .map((f) => f.slice(5, -5));
  const { data: deps, error: depsErr } = await (supabaseAdmin.rpc as any)("list_public_fk_dependencies");
  if (depsErr) throw new Error(`Lecture des dépendances impossible : ${depsErr.message}`);
  const ordered = sortTablesByDependencies(tableNames, (deps ?? []) as any);

  const report: RestoreReport = {
    dry_run: dryRun,
    fileName,
    sha256_ok: shaOk,
    pre_backup_id: null,
    tables: [],
    restored_tables: [],
    users: { succes: 0, echecs: 0 },
    files: 0,
    errors: [],
    stopped_at: null,
  };

  const rowsByTable = new Map<string, any[]>();
  for (const t of ordered) {
    const rows = JSON.parse(await zip.file(`data/${t}.json`)!.async("string"));
    rowsByTable.set(t, Array.isArray(rows) ? rows : []);
    const { count, error } = await (supabaseAdmin.from(t as any) as any).select("*", { count: "exact", head: true });
    const base = error ? null : (count ?? 0);
    report.tables.push({
      table: t,
      lignes_archive: rowsByTable.get(t)!.length,
      lignes_base: base,
      difference: base === null ? null : rowsByTable.get(t)!.length - base,
    });
  }
  if (dryRun) return report;

  // Sauvegarde de sécurité obligatoire avant d'écrire quoi que ce soit.
  const { orchestrateBackup } = await import("./backup-orchestrator.server");
  try {
    const pre = await orchestrateBackup({ trigger: "manuel", author: "pre-restauration", userId: opts.userId });
    report.pre_backup_id = pre.backupId;
  } catch (e) {
    throw new Error(`Sauvegarde de sécurité échouée, restauration abandonnée : ${(e as Error).message}`);
  }

  try {
    for (const t of ordered) {
      const rows = rowsByTable.get(t)!;
      if (!rows.length) continue;
      const pk = getTablePK(t);
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await (supabaseAdmin.from(t as any) as any).upsert(rows.slice(i, i + 500), { onConflict: pk });
        if (error) {
          report.stopped_at = t;
          throw new Error(`Table ${t} : ${error.message}`);
        }
      }
      report.restored_tables.push(t);
    }

    const authFile = zip.file("auth/users.json");
    if (authFile) {
      const { users = [] } = JSON.parse(await authFile.async("string"));
      for (const u of users) {
        const { error } = await supabaseAdmin.auth.admin.createUser({
          id: u.id,
          email: u.email,
          email_confirm: true,
          user_metadata: u.user_metadata,
          app_metadata: u.app_metadata,
        } as any);
        if (!error) {
          report.users.succes++;
          continue;
        }
        const { error: upErr } = await supabaseAdmin.auth.admin.updateUserById(u.id, {
          user_metadata: u.user_metadata,
          app_metadata: u.app_metadata,
        });
        if (upErr) {
          report.users.echecs++;
          report.errors.push(`Compte ${u.email ?? u.id} : ${upErr.message}`);
        } else report.users.succes++;
      }
    }

    const sm = zip.file("storage/_manifest.json");
    if (sm) {
      const storageManifest = JSON.parse(await sm.async("string"));
      for (const bucket of storageManifest.buckets ?? []) {
        for (const obj of bucket.objects ?? []) {
          if (!obj.embedded) continue;
          const f = zip.file(`storage/${bucket.id}/${obj.path}`);
          if (!f) {
            report.errors.push(`Fichier ${obj.path} absent de l'archive`);
            continue;
          }
          const { error } = await supabaseAdmin.storage
            .from(bucket.id)
            .upload(obj.path, await f.async("uint8array"), { upsert: true, contentType: obj.mimetype });
          if (error) report.errors.push(`Fichier ${obj.path} : ${error.message}`);
          else report.files++;
        }
      }
    }
  } catch (e) {
    report.errors.push((e as Error).message);
  }

  await supabaseAdmin.from("audit_logs").insert({
    user_id: opts.userId,
    action: "backup_restore",
    table_name: "backups",
    record_id: opts.backupId || "external_upload",
    new_values: report as any,
  });

  if (report.stopped_at)
    throw new Error(
      `Restauration arrêtée à la table ${report.stopped_at} (${report.errors[0]}). Sauvegarde de sécurité : ${report.pre_backup_id}`,
    );
  return report;
}

function getTablePK(table: string): string {
  const PK_MAP: Record<string, string> = {
    profiles: "id",
    rbac_roles: "id",
    rbac_permissions: "code",
    user_roles: "id",
    parametres_systeme: "parametre_id",
    clients: "client_id",
    fournisseurs: "fournisseur_id",
    produits: "produit_id",
    employes: "employe_id",
    commandes: "commande_id",
    factures: "facture_id",
    achats: "achat_id",
    stock_mouvements: "mouvement_id",
    inventaires: "inventaire_id",
    audit_logs: "id",
  };
  return PK_MAP[table] || "id";
}
