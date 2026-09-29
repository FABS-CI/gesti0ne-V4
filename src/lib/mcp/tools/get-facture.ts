import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { getAdmin } from "../supabase";

export default defineTool({
  name: "get_facture",
  title: "Détail d'une facture",
  description: "Retourne le détail d'une facture par sa référence ou son id.",
  inputSchema: {
    reference: z.string().optional(),
    facture_id: z.string().uuid().optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ reference, facture_id }) => {
    if (!reference && !facture_id) {
      return {
        content: [{ type: "text", text: "Fournir reference ou facture_id." }],
        isError: true,
      };
    }
    const supabase = await getAdmin();
    let q = supabase
      .from("factures")
      .select(
        "facture_id, reference, client_id, client_nom, commande_id, date_facture, date_echeance, montant_total, montant_paye, statut",
      )
      .limit(1);
    if (facture_id) q = q.eq("facture_id", facture_id);
    else if (reference) q = q.eq("reference", reference);
    const { data, error } = await q.maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Facture introuvable." }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { facture: data },
    };
  },
});