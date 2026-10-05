import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type GeneratedArgs = Database["public"]["Functions"]["sec_replace_user_scope"]["Args"];

/** Arguments réels de la fonction SQL : le dépôt principal peut être absent. */
export type ReplaceUserScopeArgs = Omit<GeneratedArgs, "_principal"> & {
  _principal: string | null;
};

/**
 * Appelle `sec_replace_user_scope` (rôles + dépôts en une transaction).
 *
 * Le type généré déclare `_principal: string`, alors que la fonction SQL
 * accepte volontairement `NULL` (utilisateur sans dépôt principal — voir
 * AGENTS.md). On ne remplace JAMAIS `null` par un dépôt arbitraire : le seul
 * cast du fichier est limité à ce paramètre et à cet appel.
 */
export async function replaceUserScope(
  db: Pick<SupabaseClient<Database>, "rpc">,
  args: ReplaceUserScopeArgs,
): Promise<void> {
  const { error } = await db.rpc("sec_replace_user_scope", args as GeneratedArgs);
  if (error) throw new Error(error.message);
}
