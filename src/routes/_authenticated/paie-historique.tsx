import { createFileRoute } from "@tanstack/react-router";
import { History } from "lucide-react";
import { ResourceManager } from "@/components/crud/ResourceManager";
import { bulletinsConfig } from "@/components/paie/bulletins-config";
import { authRouteHead } from "@/lib/route-head";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

const historiqueConfig = {
  ...bulletinsConfig,
  title: "Historique des paies",
  subtitle: "Tous les bulletins enregistrés",
  icon: History,
  newHref: undefined,
  newLabel: undefined,
};

export const Route = createFileRoute("/_authenticated/paie-historique")({
  head: () => authRouteHead("Historique des paies"),
  component: () => <ResourceManager config={historiqueConfig} />,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});
