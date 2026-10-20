import { createFileRoute } from "@tanstack/react-router";
import { ResourceManager } from "@/components/crud/ResourceManager";
import { bulletinsConfig } from "@/components/paie/bulletins-config";
import { authRouteHead } from "@/lib/route-head";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/paie/")({
  head: () => authRouteHead("Paie"),
  component: () => <ResourceManager config={bulletinsConfig} />,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});
