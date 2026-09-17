// @ts-nocheck — schema temporarily reduced after reset; types.ts regenerates when tables come back.
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { getAdmin } from "../supabase";

export default defineTool({
  name: "list_colis",
  title: "Lister les colis",
  description: "Liste paginée des colis. Filtres optionnels : statut, ville_destination.",
  inputSchema: {
    statut: z.string().optional(),
    ville_destination: z.string().optional(),
    limit: z.number().int().min(1).max(100).default(25),
    offset: z.number().int().min(0).default(0),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ statut, ville_destination, limit, offset }) => {
    const supabase = await getAdmin();
    let q = supabase
      .from("colis")
      .select(
        "colis_id, reference, destinataire, statut, ville_destination, commune, date_envoi, nb_cartons, mode_acheminement, transporteur",
      )
      .order("date_envoi", { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);
    if (statut) q = q.eq("statut", statut);
    if (ville_destination) q = q.ilike("ville_destination", `%${ville_destination}%`);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { items: data ?? [], count: data?.length ?? 0 },
    };
  },
});