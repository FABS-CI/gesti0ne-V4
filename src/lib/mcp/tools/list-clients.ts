import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requirePermission, McpAccessError } from "../supabase";

export default defineTool({
  name: "list_clients",
  title: "Lister les clients",
  description:
    "Retourne une liste paginée de clients (référence, nom, ville, commune, téléphone). Filtre optionnel par ville.",
  inputSchema: {
    ville: z.string().optional().describe("Filtre par ville (partiel, insensible casse)."),
    limit: z.number().int().min(1).max(100).default(25),
    offset: z.number().int().min(0).default(0),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ ville, limit, offset }, ctx) => {
    try {
    const supabase = await requirePermission(ctx, "clients.lire");
    let q = supabase
      .from("clients")
      .select(
        "client_id, reference, nom, ville, commune, telephone, type_client, categorie, statut",
      )
      .eq("actif", true)
      .order("nom", { ascending: true })
      .range(offset, offset + limit - 1);
    if (ville) q = q.ilike("ville", `%${ville}%`);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { items: data ?? [], count: data?.length ?? 0 },
    };
    } catch (e) {
      if (e instanceof McpAccessError) return { content: [{ type: "text", text: e.message }], isError: true };
      throw e;
    }
  },
});
