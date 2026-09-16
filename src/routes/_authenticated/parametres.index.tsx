import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { ResourceManager, type ResourceConfig } from "@/components/crud/ResourceManager";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/parametres/")({
  component: () => <ResourceManager config={config} />,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

const config: ResourceConfig = {
  table: "parametres",
  idField: "parametre_id",
  title: "Paramètres",
  icon: Settings,
  newLabel: "Nouveau paramètre",
  entityLabel: "le paramètre",
  csvName: "parametres",
  searchFields: ["cle", "valeur", "description"],
  columns: [
    { name: "cle", label: "Clé", type: "mono" },
    { name: "valeur", label: "Valeur" },
    { name: "description", label: "Description" },
  ],
  fields: [
    { name: "cle", label: "Clé", required: true },
    { name: "valeur", label: "Valeur" },
    { name: "description", label: "Description", type: "textarea" },
  ],
};
