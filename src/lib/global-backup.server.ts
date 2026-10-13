/**
 * Sauvegarde globale ERP FABS-CI — archive ZIP unique contenant :
 *  A. données métier (toutes les tables publiques, JSON)
 *  B. comptes utilisateurs (auth.users, sans mots de passe)
 *  C. fichiers stockés (bytes réels, dans la limite de taille) + manifeste
 *  D. configuration technique (politiques RLS, fonctions, triggers, extensions)
 *  E. manifeste global + empreinte SHA-256
 *
 * Ce module est server-only : il n'est jamais importé depuis un composant.
 */

import { getOrCreateBackupFolder } from "@/lib/gdrive-folder";
import { sha256Hex } from "@/lib/backup-verify";

/** Taille maximale des fichiers Storage embarqués dans l'archive (octets). */
const MAX_FILE_BYTES = 15 * 1024 * 1024;
/** Budget total pour les fichiers Storage embarqués. */
const MAX_STORAGE_TOTAL_BYTES = 120 * 1024 * 1024;

export type GlobalBackupResult = {
  fileName: string;
  size: number;
  sha256: string;
  tables_count: number;
  rows_count: number;
  users_count: number;
  files_count: number;
  files_embedded: number;
  files_not_embedded: number;
  drive?: { id: string; url: string | null } | null;
};


async function listAllPublicTables(supabaseAdmin: any, config: any): Promise<string[]> {
  const fromConfig = (config?.tables ?? [])
    .map((t: any) => t?.name)
    .filter((n: string) => !!n && !n.startsWith("pg_"));
  if (fromConfig.length) return fromConfig;
  return [];
}

async function fetchTable(supabaseAdmin: any, table: string): Promise<unknown[]> {
  const rows: unknown[] = [];
  const pageSize = 1000;
  let from = 0;
  // Pagination pour ne pas dépasser les limites PostgREST.
  for (;;) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select("*")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

async function listAllObjects(supabaseAdmin: any, bucketId: string, prefix = ""): Promise<any[]> {
  const out: any[] = [];
  let offset = 0;
  const pageSize = 1000;
  for (;;) {
    const { data: entries, error } = await supabaseAdmin.storage
      .from(bucketId)
      .list(prefix, { limit: pageSize, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`storage.list(${bucketId}/${prefix}): ${error.message}`);
    if (!entries?.length) break;
    for (const entry of entries) {
      const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null || entry.metadata == null) {
        out.push(...(await listAllObjects(supabaseAdmin, bucketId, fullPath)));
      } else {
        out.push({ path: fullPath, metadata: entry.metadata, created_at: entry.created_at });
      }
    }
    if (entries.length < pageSize) break;
    offset += pageSize;
  }
  return out;
}

/**
 * Construit l'archive ZIP complète. Retourne les octets + les statistiques.
 */
export async function buildGlobalArchive(
  supabaseAdmin: any,
  opts: { 
    trigger: "manuel" | "planifie"; 
    author?: string | null;
    projectId?: string;
    projectName?: string;
  } = { trigger: "manuel" },
): Promise<{ bytes: Uint8Array; stats: Omit<GlobalBackupResult, "drive"> }> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const startedAt = new Date();

  // D. configuration technique
  let config: any = null;
  try {
    const { data, error } = await supabaseAdmin.rpc("export_config_snapshot");
    if (error) throw new Error(error.message);
    config = data;
  } catch (e) {
    config = { error: (e as Error).message };
  }
  zip.file("config/config_snapshot.json", JSON.stringify(config, null, 2));

  // A. données métier — une table illisible fait échouer toute la sauvegarde.
  let tables = await listAllPublicTables(supabaseAdmin, config);
  if (!tables.length) {
    const { data, error } = await supabaseAdmin.rpc("list_public_tables");
    if (error) throw new Error(`Liste des tables impossible : ${error.message}`);
    tables = ((data ?? []) as Array<{ table_name: string }>)
      .map((r) => r.table_name)
      .filter((n) => !!n && !n.startsWith("pg_"));
  }
  if (!tables.length) throw new Error("Aucune table à sauvegarder : archive vide refusée");
  let rowsCount = 0;
  const tableStats: Array<{ table: string; rows: number }> = [];
  const lignesParTable: Record<string, number> = {};
  for (const t of tables) {
    let rows: unknown[];
    try {
      rows = await fetchTable(supabaseAdmin, t);
    } catch (e) {
      throw new Error(`Lecture de la table impossible — ${(e as Error).message}`);
    }
    rowsCount += rows.length;
    tableStats.push({ table: t, rows: rows.length });
    lignesParTable[t] = rows.length;
    zip.file(`data/${t}.json`, JSON.stringify(rows));
  }

  // B. comptes utilisateurs
  const users: any[] = [];
  let page = 1;
  for (;;) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`auth.listUsers: ${error.message}`);
    if (!data?.users?.length) break;
    users.push(
      ...data.users.map((u: any) => ({
        id: u.id,
        email: u.email,
        phone: u.phone,
        role: u.role,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        email_confirmed_at: u.email_confirmed_at,
        user_metadata: u.user_metadata,
        app_metadata: u.app_metadata,
      })),
    );
    if (data.users.length < 200) break;
    page += 1;
  }
  zip.file("auth/users.json", JSON.stringify({ count: users.length, users }, null, 2));

  // C. fichiers stockés
  const storageManifest: any = { buckets: [] };
  const nonEmbarques: Array<{ bucket: string; path: string; taille: number; raison: string }> = [];
  let filesCount = 0;
  let filesEmbedded = 0;
  let embeddedBytes = 0;
  const { data: buckets, error: bucketsError } = await supabaseAdmin.storage.listBuckets();
  if (bucketsError) throw new Error(`Liste des espaces de fichiers impossible : ${bucketsError.message}`);
  for (const bucket of buckets ?? []) {
    // Les archives de sauvegarde elles-mêmes ne sont jamais ré-archivées.
    if (bucket.id === "erp-backups") continue;
    // Une erreur d'énumération fait échouer la sauvegarde.
    const objects: any[] = await listAllObjects(supabaseAdmin, bucket.id);
    const entries: any[] = [];
    let excludedOriginalPng = 0;
    for (const obj of objects) {
      // Exclusion permanente : les fichiers nommés exactement "original.png"
      // (tous dossiers/sous-dossiers, ex. storage-product-covers-cover) ne sont
      // jamais inclus dans l'archive de sauvegarde. Ils restent intacts dans
      // le stockage source ; seuls le ZIP et le manifeste les ignorent.
      const baseName = obj.path.split("/").pop();
      if (baseName === "original.png") {
        excludedOriginalPng += 1;
        continue;
      }
      filesCount += 1;
      const size = Number(obj.metadata?.size ?? 0);
      let embedded = false;
      let raison: string | null = null;
      if (size <= 0) raison = "taille inconnue";
      else if (size > MAX_FILE_BYTES) raison = `fichier trop gros (> ${MAX_FILE_BYTES} o)`;
      else if (embeddedBytes + size > MAX_STORAGE_TOTAL_BYTES) raison = "budget total de l'archive dépassé";
      else {
        const { data: blob, error } = await supabaseAdmin.storage
          .from(bucket.id)
          .download(obj.path);
        if (!error && blob) {
          zip.file(`storage/${bucket.id}/${obj.path}`, await blob.arrayBuffer());
          embedded = true;
          filesEmbedded += 1;
          embeddedBytes += size;
        } else {
          raison = `téléchargement impossible : ${error?.message ?? "vide"}`;
        }
      }
      let signedUrl: string | null = null;
      if (!embedded) {
        nonEmbarques.push({ bucket: bucket.id, path: obj.path, taille: size, raison: raison ?? "inconnue" });
        const { data: signed } = await supabaseAdmin.storage
          .from(bucket.id)
          .createSignedUrl(obj.path, 60 * 60 * 24 * 7);
        signedUrl = signed?.signedUrl ?? null;
      }
      entries.push({
        path: obj.path,
        size,
        mimetype: obj.metadata?.mimetype ?? null,
        embedded,
        signed_url: signedUrl,
      });
    }
    storageManifest.buckets.push({
      id: bucket.id,
      public: bucket.public,
      objects_count: entries.length,
      excluded_original_png: excludedOriginalPng,
      objects: entries,
    });
  }
  zip.file("storage/_manifest.json", JSON.stringify(storageManifest, null, 2));

  // E. manifeste global
  const manifest = {
    application: "ERP FABS-CI",
    version_archive: "1.1",
    generated_at: startedAt.toISOString(),
    trigger: opts.trigger,
    author: opts.author ?? "system",
    tables_attendues: tables,
    lignes_par_table: lignesParTable,
    non_embarques: nonEmbarques,
    contenu: {
      donnees_metier: { tables: tableStats.length, enregistrements: rowsCount, detail: tableStats },
      comptes: { count: users.length, note: "mots de passe non exportables (hachés côté Auth)" },
      fichiers: { total: filesCount, inclus: filesEmbedded, non_embarques: nonEmbarques.length, budget_octets: MAX_STORAGE_TOTAL_BYTES },
      configuration: {
        politiques: Array.isArray(config?.policies) ? config.policies.length : 0,
        fonctions: Array.isArray(config?.functions) ? config.functions.length : 0,
        triggers: Array.isArray(config?.triggers) ? config.triggers.length : 0,
      },
    },
    restauration: "Voir docs/deployment/11-runbook-sauvegarde-restauration.md",
  };
  zip.file("MANIFEST.json", JSON.stringify(manifest, null, 2));
  zip.file(
    "LISEZ-MOI.txt",
    [
      "ARCHIVE DE SAUVEGARDE GLOBALE — ERP FABS-CI",
      `Générée le ${startedAt.toISOString()} (${opts.trigger}).`,
      "",
      "Contenu :",
      "  data/       : toutes les tables métier au format JSON",
      "  auth/       : comptes utilisateurs (sans mots de passe)",
      "  storage/    : fichiers stockés + manifeste (URLs signées 7 jours si non inclus)",
      "  config/     : politiques d'accès, fonctions, triggers, extensions",
      "  MANIFEST.json : inventaire et empreintes",
      "",
      "Procédure de restauration : docs/deployment/11-runbook-sauvegarde-restauration.md",
    ].join("\n"),
  );

  const bytes = (await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  })) as Uint8Array;

  // Vérification finale obligatoire : aucun fichier nommé exactement
  // "original.png" ne doit figurer dans l'archive avant téléchargement/envoi.
  const check = await JSZip.loadAsync(bytes);
  const leaked = Object.keys(check.files).filter(
    (p) => !check.files[p].dir && p.split("/").pop() === "original.png",
  );
  if (leaked.length > 0) {
    throw new Error(
      `Contrôle de sauvegarde échoué : ${leaked.length} fichier(s) original.png présent(s) dans l'archive (ex. ${leaked[0]})`,
    );
  }

  const startedAtStr = startedAt.toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const slug = opts.projectId ? (opts.projectName || "projet").toLowerCase().replace(/[^a-z0-9]/g, "_") : "global";
  const fileName = `backup_${slug}_${startedAtStr}.zip`;
  
  return {
    bytes,
    stats: {
      fileName,
      size: bytes.byteLength,
      sha256: await sha256Hex(bytes),
      tables_count: tableStats.length,
      rows_count: rowsCount,
      users_count: users.length,
      files_count: filesCount,
      files_embedded: filesEmbedded,
      files_not_embedded: nonEmbarques.length,
    },
  };
}

/** Envoie l'archive ZIP sur Google Drive (dossier de sauvegarde dédié). */
export async function uploadArchiveToDrive(
  fileName: string,
  bytes: Uint8Array,
  description: string,
): Promise<{ id: string; url: string | null }> {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const GDRIVE_KEY = process.env.GOOGLE_DRIVE_API_KEY;
  if (!LOVABLE_API_KEY || !GDRIVE_KEY) throw new Error("Connecteur Google Drive non configuré");
  const folderId = await getOrCreateBackupFolder(LOVABLE_API_KEY, GDRIVE_KEY);
  if (!folderId) throw new Error("Dossier Google Drive introuvable");

  const boundary = `----lovable-${crypto.randomUUID()}`;
  const enc = new TextEncoder();
  const head = enc.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify({
        name: fileName,
        mimeType: "application/zip",
        description,
        parents: [folderId],
      }) +
      `\r\n--${boundary}\r\nContent-Type: application/zip\r\n\r\n`,
  );
  const tail = enc.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(head.length + bytes.length + tail.length);
  body.set(head, 0);
  body.set(bytes, head.length);
  body.set(tail, head.length + bytes.length);

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
  if (!res.ok) throw new Error(`Google Drive [${res.status}]: ${await res.text()}`);
  const json = (await res.json()) as { id: string; webViewLink?: string };
  return { id: json.id, url: json.webViewLink ?? null };
}

/** Supprime les archives Drive au-delà des N plus récentes (rotation). */
export async function rotateDriveArchives(keep = 30): Promise<number> {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const GDRIVE_KEY = process.env.GOOGLE_DRIVE_API_KEY;
  if (!LOVABLE_API_KEY || !GDRIVE_KEY) return 0;
  const folderId = await getOrCreateBackupFolder(LOVABLE_API_KEY, GDRIVE_KEY);
  if (!folderId) return 0;
  const headers = {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": GDRIVE_KEY,
  } as const;
  const q = encodeURIComponent(
    `'${folderId}' in parents and name contains 'fabsci_sauvegarde_globale_' and trashed=false`,
  );
  const res = await fetch(
    `https://connector-gateway.lovable.dev/google_drive/drive/v3/files?q=${q}&orderBy=createdTime desc&pageSize=200&fields=files(id,name,createdTime)`,
    { headers },
  );
  if (!res.ok) return 0;
  const { files = [] } = (await res.json()) as { files?: Array<{ id: string }> };
  const toDelete = files.slice(keep);
  let deleted = 0;
  for (const f of toDelete) {
    const del = await fetch(
      `https://connector-gateway.lovable.dev/google_drive/drive/v3/files/${f.id}`,
      { method: "DELETE", headers },
    );
    if (del.ok) deleted += 1;
  }
  return deleted;
}
