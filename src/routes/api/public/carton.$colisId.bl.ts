import { createFileRoute } from "@tanstack/react-router";

/**
 * Renvoie les données du Bon de Livraison rattaché au carton scanné.
 * Aucune donnée financière n'est exposée ; l'identifiant du BL n'est jamais
 * fourni par le client : il est résolu côté serveur depuis le carton.
 */
export const Route = createFileRoute("/api/public/carton/$colisId/bl")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const { colisId } = params as { colisId: string };
        const noStore = { "Cache-Control": "no-store" };

        try {
          const { isUuid, loadCartonBlPayload } = await import("@/lib/logistique/carton-bl.server");
          if (!isUuid(colisId)) {
            return Response.json({ error: "Carton introuvable" }, { status: 404, headers: noStore });
          }

          const { isRateLimited } = await import("@/lib/certification/certification.server");
          const ip =
            request.headers.get("cf-connecting-ip") ??
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
            null;
          if (await isRateLimited(ip)) {
            return Response.json(
              { error: "Trop de requêtes, réessayez plus tard." },
              { status: 429, headers: noStore },
            );
          }

          const payload = await loadCartonBlPayload(colisId);
          if (!payload) {
            return Response.json(
              { error: "Bon de livraison indisponible" },
              { status: 404, headers: noStore },
            );
          }
          return Response.json(payload, { status: 200, headers: noStore });
        } catch (error) {
          console.error("[carton/bl] erreur", colisId, error);
          return Response.json(
            { error: "Téléchargement temporairement indisponible" },
            { status: 503, headers: noStore },
          );
        }
      },
    },
  },
});
