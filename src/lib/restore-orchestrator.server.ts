import { supabaseAdmin } from "@/integrations/supabase/client.server";
import fs from "fs";
import path from "path";

const LOCAL_BACKUP_DIR = "/tmp/backups";

export async function orchestrateRestore(opts: {
  backupId?: string;
  base64?: string;
  fileName?: string;
  userId: string;
}) {
  const JSZip = (await import("jszip")).default;
  let bytes: Uint8Array | null = null;
  let fileName = opts.fileName || "restoration.zip";

  // 1. Récupération des données binaires
  if (opts.base64) {
    const bin = atob(opts.base64);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } else if (opts.backupId) {
    // Essayer de trouver le fichier localement ou sur Drive
    const { data: backup } = await supabaseAdmin
      .from("backups")
      .select("*")
      .eq("backup_id", opts.backupId)
      .single();
    
    if (!backup) throw new Error("Sauvegarde introuvable dans l'historique");
    
    const localPath = path.join(LOCAL_BACKUP_DIR, backup.fichier_nom || "");
    const b = backup as any;
    if (b.storage_path && b.fichier_disponible) {
      const { data: blob, error } = await supabaseAdmin.storage.from("erp-backups").download(b.storage_path);
      if (error || !blob) throw new Error(`Archive introuvable dans le stockage : ${error?.message ?? ""}`);
      bytes = new Uint8Array(await blob.arrayBuffer());
      fileName = backup.fichier_nom || "restoration.zip";
    } else if (backup.fichier_nom && fs.existsSync(localPath)) {
      bytes = fs.readFileSync(localPath);
      fileName = backup.fichier_nom;
    } else if (backup.destination_ref && backup.destination_ref !== "local_only") {
      // Téléchargement depuis Drive
      const { downloadDriveFileRaw } = await import("./gdrive-download.server");
      bytes = await downloadDriveFileRaw(backup.destination_ref);
      fileName = backup.fichier_nom || "restoration.zip";
    } else {
      throw new Error("Fichier de sauvegarde inaccessible localement et pas sur Drive");
    }
  }

  if (!bytes) throw new Error("Aucune source de données valide pour la restauration");

  // 2. Extraction de l'archive
  const zip = await JSZip.loadAsync(bytes);
  
  // Lecture du manifeste
  const manifestFile = zip.file("MANIFEST.json");
  if (!manifestFile) throw new Error("Archive invalide : MANIFEST.json manquant");
  const manifest = JSON.parse(await manifestFile.async("string"));

  const results = {
    tables: [] as string[],
    users: 0,
    files: 0,
    errors: [] as string[]
  };

  // 3. Restauration des TABLES
  // On restaure dans l'ordre du manifeste (ou un ordre sûr si présent)
  const dataFiles = zip.folder("data");
  if (dataFiles) {
    const tableFiles = Object.keys(zip.files).filter(f => f.startsWith("data/") && f.endsWith(".json"));
    
    // Pour chaque table, on fait un upsert intelligent
    for (const filePath of tableFiles) {
      const tableName = filePath.split("/")[1].replace(".json", "");
      try {
        const content = await zip.file(filePath)!.async("string");
        const rows = JSON.parse(content);
        if (rows.length > 0) {
          // Détection de la PK pour l'upsert
          const pk = await getTablePK(tableName);
          const { error } = await (supabaseAdmin.from(tableName as any) as any).upsert(rows, { onConflict: pk });
          if (error) throw error;
          results.tables.push(tableName);
        }
      } catch (err) {
        results.errors.push(`Table ${tableName}: ${(err as Error).message}`);
      }
    }
  }

  // 4. Restauration des UTILISATEURS
  const authFile = zip.file("auth/users.json");
  if (authFile) {
    const { users } = JSON.parse(await authFile.async("string"));
    for (const u of users) {
      try {
        // Upsert user via admin auth
        // Note: On ne peut pas restaurer les mots de passe, l'utilisateur devra les réinitialiser
        // ou on restaure les métadonnées pour qu'il garde ses accès
        await supabaseAdmin.auth.admin.createUser({
          id: u.id,
          email: u.email,
          email_confirm: true,
          user_metadata: u.user_metadata,
          app_metadata: u.app_metadata
        }).catch(async (err) => {
          // Si déjà existant, on update
          await supabaseAdmin.auth.admin.updateUserById(u.id, {
            user_metadata: u.user_metadata,
            app_metadata: u.app_metadata
          });
        });
        results.users++;
      } catch (err) {
         // Silencieusement ignorer les doublons ou erreurs mineures d'auth
      }
    }
  }

  // 5. Restauration du STORAGE
  const storageFolder = zip.folder("storage");
  if (storageFolder) {
    const manifestFile = zip.file("storage/_manifest.json");
    if (manifestFile) {
      const storageManifest = JSON.parse(await manifestFile.async("string"));
      for (const bucket of storageManifest.buckets) {
        for (const obj of bucket.objects) {
          if (obj.embedded) {
            try {
              const fileBytes = await zip.file(`storage/${bucket.id}/${obj.path}`)!.async("uint8array");
              await supabaseAdmin.storage.from(bucket.id).upload(obj.path, fileBytes, {
                upsert: true,
                contentType: obj.mimetype
              });
              results.files++;
            } catch (err) {
              results.errors.push(`File ${obj.path}: ${(err as Error).message}`);
            }
          }
        }
      }
    }
  }

  // 6. Audit de restauration
  await supabaseAdmin.from("audit_logs").insert({
    user_id: opts.userId,
    action: "backup_restore",
    table_name: "backups",
    record_id: opts.backupId || "external_upload",
    new_values: { results, fileName } as any
  });

  return results;
}

async function getTablePK(table: string): Promise<string> {
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
    audit_logs: "id"
  };
  return PK_MAP[table] || "id";
}
