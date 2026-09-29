import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { getAdmin } from "../supabase";

export default defineTool({
  name: "get_client",
  title: "Détail d'un client",
  description: "Retourne le détail d'un client par sa référence (ex: CLI-0042) ou son id.",
  inputSchema: {
    reference: z.string().optional().describe("Référence du client."),
    client_id: z.string().uuid().optional().describe("UUID du client."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ reference, client_id }) => {
    if (!reference && !client_id) {
      return {
        content: [{ type: "text", text: "Fournir reference ou client_id." }],
        isError: true,
      };
    }
    const supabase = await getAdmin();
    let q = supabase
      .from("clients")
      .select(
        "client_id, reference, nom, type_client, ville, commune, quartier, telephone, representant, categorie, secteur_activite, statut",
      )

      .limit(1);
    if (client_id) q = q.eq("client_id", client_id);
    else if (reference) q = q.eq("reference", reference);
    const { data, error } = await q.maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Client introuvable." }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { client: data },
    };
  },
});