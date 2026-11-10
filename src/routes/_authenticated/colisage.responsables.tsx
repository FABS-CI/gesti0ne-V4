import { createFileRoute } from "@tanstack/react-router";
import { UserCog } from "lucide-react";
import { ResourceManager, type ResourceConfig } from "@/components/crud/ResourceManager";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

const config: ResourceConfig = {
  table: "preparateurs_colisage",
  idField: "preparateur_id",
  title: "Préparateurs & Responsables de colisage",
  overline: "Logistique",
  subtitle:
    "Liste libre des préparateurs et superviseurs (indépendante du registre des employés).",
  icon: UserCog,
  newLabel: "Nouveau préparateur",
  entityLabel: "le préparateur",
  csvName: "preparateurs_colisage",
  searchFields: ["nom", "telephone", "poste"],
  columns: [
    { name: "nom", label: "Nom" },
    { name: "poste", label: "Poste / Rôle" },
    { name: "telephone", label: "Téléphone" },
    {
      name: "actif",
      label: "Statut",
      type: "badge",
      options: [
        { value: "true", label: "Actif", color: "#10B981" },
        { value: "false", label: "Inactif", color: "#94A3B8" },
      ],
    },
  ],
  fields: [
    { name: "nom", label: "Nom complet", required: true },
    { name: "telephone", label: "Téléphone" },
    { name: "poste", label: "Poste / Rôle (ex : Préparateur, Chef d'équipe…)" },
    {
      name: "depot_id",
      label: "Dépôt affecté (optionnel)",
      type: "lookup",
      lookup: {
        table: "depots",
        valueField: "depot_id",
        labelField: "nom",
        orderBy: "nom",
      },
    },
    {
      name: "actif",
      label: "Actif",
      type: "select",
      options: [
        { value: "true", label: "Oui" },
        { value: "false", label: "Non" },
      ],
      default: "true",
    },
    { name: "observations", label: "Observations", type: "textarea", colSpan: 2 },
  ],
};

export const Route = createFileRoute("/_authenticated/colisage/responsables")({
  component: () => <ResourceManager config={config} />,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});
