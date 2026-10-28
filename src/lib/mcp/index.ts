import { defineMcp, auth } from "@lovable.dev/mcp-js";
import listClients from "./tools/list-clients";
import getClient from "./tools/get-client";
import listCommandes from "./tools/list-commandes";
import getCommande from "./tools/get-commande";
import getFacture from "./tools/get-facture";
import listProduits from "./tools/list-produits";
import getStockProduit from "./tools/get-stock-produit";
import listColis from "./tools/list-colis";
import getColis from "./tools/get-colis";
import search from "./tools/search";

const SUPABASE_URL =
  (typeof process !== "undefined" && process.env?.SUPABASE_URL) ||
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL);
if (!SUPABASE_URL) {
  throw new Error("SUPABASE_URL manquant : le serveur MCP refuse de démarrer sans adresse de base.");
}

export default defineMcp({
  name: "fabsci-mcp",
  title: "FabsCI Gestion — MCP",
  version: "0.1.0",
  instructions:
    "Outils de consultation en lecture seule pour FabsCI Gestion : recherche transverse, clients, commandes, factures, produits, stocks par dépôt et colis. Toutes les opérations sont read-only. Utilise `search` pour un mot-clé transverse, puis les `get_*` pour un détail précis.",
  // Exige un JWT Supabase valide sur toute requête MCP. Empêche l'accès anonyme
  // une fois l'application publiée.
  auth: auth.oauth.issuer({
    issuer: `${SUPABASE_URL}/auth/v1`,
    jwksUri: `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
    acceptedAudiences: ["authenticated"],
    resourceName: "FabsCI Gestion MCP",
  }),
  tools: [
    search,
    listClients,
    getClient,
    listCommandes,
    getCommande,
    getFacture,
    listProduits,
    getStockProduit,
    listColis,
    getColis,
  ],
});
