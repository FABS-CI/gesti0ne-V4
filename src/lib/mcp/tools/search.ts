import { pgSafe } from "@/lib/postgrest-filter";
// @ts-nocheck — schema temporarily reduced after reset; types.ts regenerates when tables come back.
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { getAdmin } from "../supabase";

export default defineTool({
  name: "search",
  title: "Recherche globale",
  description:
    "Recherche transverse : clients, produits, commandes, factures, colis (max 5 par type).",
  inputSchema: {
    query: z.string().min(1),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query }) => {
    const supabase = await getAdmin();
    const q = pgSafe(query);
    const like = `%${q}%`;
    const [clients, produits, commandes, factures, colis] = await Promise.all([
      supabase
        .from("clients")
        .select("client_id, reference, nom, ville, telephone")
        .or(`nom.ilike.${like},reference.ilike.${like},telephone.ilike.${like}`)
        .limit(5),
      supabase
        .from("produits")
        .select("produit_id, reference, titre, isbn, prix_vente")
        .or(`titre.ilike.${like},reference.ilike.${like},isbn.ilike.${like}`)
        .limit(5),
      supabase
        .from("commandes")
        .select("commande_id, numero, client_nom, statut, montant_total")
        .or(`numero.ilike.${like},reference.ilike.${like},client_nom.ilike.${like}`)
        .limit(5),
      supabase
        .from("factures")
        .select("facture_id, reference, client_nom, montant_total, statut")
        .or(`reference.ilike.${like},client_nom.ilike.${like}`)
        .limit(5),
      supabase
        .from("colis")
        .select("colis_id, reference, destinataire, statut, ville_destination")
        .or(`reference.ilike.${like},destinataire.ilike.${like}`)
        .limit(5),
    ]);
    const result = {
      clients: clients.data ?? [],
      produits: produits.data ?? [],
      commandes: commandes.data ?? [],
      factures: factures.data ?? [],
      colis: colis.data ?? [],
    };
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  },
});