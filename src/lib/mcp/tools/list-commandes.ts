import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { getAdmin } from "../supabase";

export default defineTool({
  name: "list_commandes",
  title: "Lister les commandes",
  description: "Liste paginée des commandes. Filtres optionnels : statut, client_id.",
  inputSchema: {
    statut: z.string().optional(),
    client_id: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(100).default(25),
    offset: z.number().int().min(0).default(0),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ statut, client_id, limit, offset }) => {
    const supabase = await getAdmin();
    let q = supabase
      .from("commandes")
      .select(
        "commande_id, numero, reference, client_id, client_nom, statut, date_commande, montant_total, nb_produits",
      )
      .order("date_commande", { ascending: false })
      .range(offset, offset + limit - 1);
    if (statut) q = q.eq("statut", statut);
    if (client_id) q = q.eq("client_id", client_id);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { items: data ?? [], count: data?.length ?? 0 },
    };
  },
});