import { createFileRoute, redirect } from "@tanstack/react-router";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

// Doublon supprimé — la gestion des tournées est centralisée dans le module /tournees.
export const Route = createFileRoute("/_authenticated/livraison-suivi/tournees/")({
  beforeLoad: () => {
    throw redirect({ to: "/tournees" });
  },
});
