import { createFileRoute } from "@tanstack/react-router";
import { ResourceManager } from "@/components/crud/ResourceManager";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/workflows-definitions")({
  component: () => (
    <ResourceManager
      config={{
        table: "workflows_definitions",
        idField: "id",
        title: "Définitions de workflows",
        subtitle: "Modèles d'approbation (workflow simple : approuvé / rejeté)",
        newLabel: "Nouveau workflow",
        entityLabel: "workflow",
        searchFields: ["code", "libelle", "description"],
        csvName: "workflows-definitions",
        columns: [
          { name: "code", label: "Code", type: "mono" },
          { name: "libelle", label: "Libellé" },
          { name: "description", label: "Description" },
          {
            name: "actif",
            label: "Actif",
            type: "badge",
            options: [
              { value: "true", label: "Oui", color: "#10B981" },
              { value: "false", label: "Non", color: "#EF4444" },
            ],
          },
        ],
        fields: [
          { name: "code", label: "Code", required: true },
          { name: "libelle", label: "Libellé", required: true },
          {
            name: "actif",
            label: "Actif",
            type: "select",
            default: "true",
            options: [
              { value: "true", label: "Oui" },
              { value: "false", label: "Non" },
            ],
          },
          { name: "description", label: "Description", type: "textarea", colSpan: 2 },
        ],
      }}
    />
  ),
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});
