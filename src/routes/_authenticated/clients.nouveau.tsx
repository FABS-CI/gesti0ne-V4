import { createFileRoute } from "@tanstack/react-router";
import { ClientRapideForm } from "@/components/clients/form/ClientRapideForm";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/clients/nouveau")({
  component: () => <ClientRapideForm />,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});