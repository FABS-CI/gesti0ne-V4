import { createFileRoute } from "@tanstack/react-router";
import { ResourceManager } from "@/components/crud/ResourceManager";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/fonctions")({
  component: () => (
    <ResourceManager
      config={{
        table: "fonctions",
        idField: "fonction_id",
        title: "Fonctions / Postes",
        subtitle: "Référentiel RH",
        newLabel: "Nouvelle fonction",
        entityLabel: "fonction",
        searchFields: ["libelle", "description"],
        csvName: "fonctions",
        columns: [
          { name: "libelle", label: "Libellé" },
          { name: "description", label: "Description" },
        ],
        fields: [
          { name: "libelle", label: "Libellé", required: true, colSpan: 2 },
          { name: "description", label: "Description", type: "textarea", colSpan: 2 },
        ],
      }}
    />
  ),
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});
