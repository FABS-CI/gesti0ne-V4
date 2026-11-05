import { createFileRoute } from "@tanstack/react-router";
import { ResourceManager } from "@/components/crud/ResourceManager";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

const STATUTS = [
  { value: "planifiee", label: "Planifiée", color: "#94A3B8" },
  { value: "en_cours", label: "En cours", color: "#F97316" },
  { value: "livree", label: "Livrée", color: "#10B981" },
  { value: "echouee", label: "Échouée", color: "#EF4444" },
];

export const Route = createFileRoute("/_authenticated/expeditions")({
  component: () => (
    <ResourceManager
      config={{
        table: "expeditions",
        idField: "expedition_id",
        title: "Expéditions",
        subtitle: "Suivi logistique des envois",
        newLabel: "Nouvelle expédition",
        entityLabel: "expédition",
        searchFields: ["reference", "transporteur", "tracking"],
        csvName: "expeditions",
        statusFilter: { field: "statut", options: STATUTS },
        columns: [
          { name: "reference", label: "Référence", type: "mono" },
          { name: "transporteur", label: "Transporteur" },
          { name: "tracking", label: "N° suivi", type: "mono" },
          { name: "date_depart", label: "Départ", type: "date" },
          { name: "date_arrivee_prevue", label: "Arrivée prévue", type: "date" },
          { name: "cout", label: "Coût", type: "money" },
          { name: "statut", label: "Statut", type: "badge", options: STATUTS },
        ],
        fields: [
          { name: "transporteur", label: "Transporteur" },
          { name: "tracking", label: "Numéro de suivi" },
          { name: "date_depart", label: "Date de départ", type: "date" },
          { name: "date_arrivee_prevue", label: "Arrivée prévue", type: "date" },
          { name: "date_arrivee_reelle", label: "Arrivée réelle", type: "date" },
          { name: "cout", label: "Coût (FCFA)", type: "money" },
          {
            name: "statut",
            label: "Statut",
            type: "select",
            options: STATUTS,
            default: "planifiee",
          },
          {
            name: "tournee_id",
            label: "Tournée",
            type: "lookup",
            lookup: {
              table: "tournees",
              valueField: "tournee_id",
              labelField: "reference",
              orderBy: "date_tournee",
            },
          },
          { name: "notes", label: "Notes", type: "textarea", colSpan: 2 },
        ],
      }}
    />
  ),
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});
