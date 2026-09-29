import { pgSafe } from "@/lib/postgrest-filter";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { getAdmin } from "../supabase";

export default defineTool({
  name: "list_produits",
  title: "Catalogue produits",
  description:
    "Liste paginée du catalogue produits. Recherche optionnelle par titre / référence / ISBN.",
  inputSchema: {
    search: z.string().optional(),
    niveau: z.string().optional(),
    limit: z.number().int().min(1).max(100).default(25),
    offset: z.number().int().min(0).default(0),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, niveau, limit, offset }) => {
    const supabase = await getAdmin();
    let q = supabase
      .from("produits")
      .select(
        "produit_id, reference, titre, isbn, categorie, niveau, matiere, editeur, prix_vente, stock",
      )
      .eq("actif", true)
      .order("titre", { ascending: true })
      .range(offset, offset + limit - 1);
    if (niveau) q = q.ilike("niveau", `%${niveau}%`);
    if (search) {
      const s = search.replace(/[,()]/g, " ").trim();
      q = q.or(`titre.ilike.%${pgSafe(s)}%,reference.ilike.%${pgSafe(s)}%,isbn.ilike.%${pgSafe(s)}%`);
    }
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { items: data ?? [], count: data?.length ?? 0 },
    };
  },
});