import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Orchestrateur de sauvegarde globale (Google Drive + Local).
 * Peut être appelé manuellement depuis l'UI ou automatiquement via cron.
 */
export const runFullBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => 
    z.object({ 
      trigger: z.enum(["manuel", "planifie"]).default("manuel"),
      projectId: z.string().optional(),
      projectName: z.string().optional(),
      scope: z.enum(["GLOBAL", "PROJECT"]).optional(),
      isTest: z.boolean().optional()
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    
    // Vérification RBAC : seuls les admins peuvent déclencher une sauvegarde
    const { data: isAdmin } = await supabase.rpc("has_role_compat", {
      _user_id: userId,
      _role: "super_admin",
    });
    if (isAdmin !== true) throw new Response("Forbidden", { status: 403 });

    const { orchestrateBackup } = await import("./backup-orchestrator.server");
    const email = (claims as { email?: string } | null)?.email ?? "system";
    
    return orchestrateBackup({
      trigger: data.trigger,
      author: email,
      userId: userId,
      projectId: data.projectId,
      projectName: data.projectName,
      scope: data.scope,
      isTest: data.isTest
    });
  });

/**
 * Point d'entrée pour la restauration intégrale.
 */
export const runFullRestore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => 
    z.object({ 
      backupId: z.string().optional(), // Si on restaure depuis l'historique
      base64: z.string().optional(),   // Si on upload un fichier
      fileName: z.string().optional()
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    
    // Sécurité CRITIQUE : Seul le super_admin peut restaurer
    const { data: isAdmin } = await supabase.rpc("has_role_compat", {
      _user_id: userId,
      _role: "super_admin",
    });
    if (isAdmin !== true) throw new Response("Forbidden", { status: 403 });

    const { orchestrateRestore } = await import("./restore-orchestrator.server");
    
    return orchestrateRestore({
      backupId: data.backupId,
      base64: data.base64,
      fileName: data.fileName,
      userId
    });
  });
