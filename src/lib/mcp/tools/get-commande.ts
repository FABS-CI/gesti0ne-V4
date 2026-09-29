import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { getAdmin } from "../supabase";

export default defineTool({
  name: "get_commande",
  title: "Détail d'une commande",
  description: "Retourne l'en-tête d'une commande + ses lignes.",
  inputSchema: {
    numero: z.string().optional(),
    commande_id: z.string().uuid().optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ numero, commande_id }) => {
    if (!numero && !commande_id) {
      return { content: [{ type: "text", text: "Fournir numero ou commande_id." }], isError: true };
    }
    const supabase = await getAdmin();
    let q = supabase
      .from("commandes")
      .select(
        "commande_id, numero, reference, client_id, client_nom, statut, date_commande, montant_total, remise, nb_produits, etablissement, ville, representant_nom",
      )
      .limit(1);
    if (commande_id) q = q.eq("commande_id", commande_id);
    else if (numero) q = q.eq("numero", numero);
    const { data: cmd, error: e1 } = await q.maybeSingle();
    if (e1) return { content: [{ type: "text", text: e1.message }], isError: true };
    if (!cmd) return { content: [{ type: "text", text: "Commande introuvable." }], isError: true };
    const { data: lignes, error: e2 } = await supabase
      .from("commande_lignes")
      .select(
        "ligne_id, produit_id, reference_produit, designation, quantite, prix_unitaire, remise_pct, total_ligne",
      )
      .eq("commande_id", cmd.commande_id);
    if (e2) return { content: [{ type: "text", text: e2.message }], isError: true };
    const out = { ...cmd, lignes: lignes ?? [] };
    return {
      content: [{ type: "text", text: JSON.stringify(out, null, 2) }],
      structuredContent: { commande: out },
    };
  },
});