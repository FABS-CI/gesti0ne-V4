import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { getAdmin } from "../supabase";

export default defineTool({
  name: "get_stock_produit",
  title: "Stock d'un produit par dépôt",
  description: "Retourne le stock d'un produit dans chaque dépôt.",
  inputSchema: {
    reference: z.string().optional(),
    produit_id: z.string().uuid().optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ reference, produit_id }) => {
    if (!reference && !produit_id) {
      return {
        content: [{ type: "text", text: "Fournir reference ou produit_id." }],
        isError: true,
      };
    }
    const supabase = await getAdmin();
    let pid = produit_id;
    if (!pid && reference) {
      const { data: p, error: ep } = await supabase
        .from("produits")
        .select("produit_id")
        .eq("reference", reference)
        .maybeSingle();
      if (ep) return { content: [{ type: "text", text: ep.message }], isError: true };
      if (!p) return { content: [{ type: "text", text: "Produit introuvable." }], isError: true };
      pid = p.produit_id;
    }
    if (!pid) {
      return {
        content: [{ type: "text", text: "Produit introuvable." }],
        isError: true,
      };
    }
    const { data, error } = await supabase
      .from("stocks_depots")
      .select("depot_id, quantite, seuil_alerte, depots(code, nom, ville)")
      .eq("produit_id", pid);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { produit_id: pid, stocks: data ?? [] },
    };
  },
});