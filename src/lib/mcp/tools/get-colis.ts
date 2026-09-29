import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { getAdmin } from "../supabase";

export default defineTool({
  name: "get_colis",
  title: "Détail d'un colis",
  description: "Retourne le détail d'un colis + son historique de statut.",
  inputSchema: {
    reference: z.string().optional(),
    colis_id: z.string().uuid().optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ reference, colis_id }) => {
    if (!reference && !colis_id) {
      return { content: [{ type: "text", text: "Fournir reference ou colis_id." }], isError: true };
    }
    const supabase = await getAdmin();
    let q = supabase.from("colis").select("*").limit(1);
    if (colis_id) q = q.eq("colis_id", colis_id);
    else if (reference) q = q.eq("reference", reference);
    const { data, error } = await q.maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Colis introuvable." }], isError: true };
    const { data: hist } = await supabase
      .from("colis_statut_historique")
      .select("*")
      .eq("colis_id", data.colis_id)
      .order("created_at", { ascending: false });
    const out = { ...data, historique: hist ?? [] };
    return {
      content: [{ type: "text", text: JSON.stringify(out, null, 2) }],
      structuredContent: { colis: out },
    };
  },
});