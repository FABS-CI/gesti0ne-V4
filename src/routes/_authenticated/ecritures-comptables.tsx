import { createFileRoute, redirect } from "@tanstack/react-router";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

// La saisie et la consultation des écritures se font dans le Journal Comptable :
// cette page y renvoie directement pour éviter un doublon.
export const Route = createFileRoute("/_authenticated/ecritures-comptables")({
  beforeLoad: () => {
    throw redirect({ to: "/comptabilite" });
  },
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});
