import { createFileRoute } from "@tanstack/react-router";
import { ResourceManager, type ResourceConfig } from "@/components/crud/ResourceManager";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/missions")({
  component: () => <ResourceManager config={config} />,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

const statuts = [
  { value: "planifiee", label: "Planifiée", color: "#3B82F6" },
  { value: "en_cours", label: "En cours", color: "#F97316" },
  { value: "terminee", label: "Terminée", color: "#10B981" },
  { value: "annulee", label: "Annulée", color: "#EF4444" },
];

const config: ResourceConfig = {
  table: "missions",
  idField: "mission_id",
  title: "Missions",
  subtitle: "Missions et déplacements professionnels",
  newLabel: "Nouvelle mission",
  entityLabel: "la mission",
  csvName: "missions",
  searchFields: ["reference", "employe_nom", "destination"],
  statusFilter: { field: "statut", options: statuts },
  columns: [
    { name: "reference", label: "Référence", type: "mono" },
    { name: "employe_nom", label: "Employé" },
    { name: "destination", label: "Destination" },
    { name: "date_debut", label: "Début" },
    { name: "budget", label: "Budget", type: "money", align: "right" },
    { name: "statut", label: "Statut", type: "badge", options: statuts },
  ],
  fields: [
    {
      name: "_employe_search",
      label: "Rechercher un employé",
      type: "employee-search",
      virtual: true,
      colSpan: 2,
      onSelectPatch: (e) => ({ employe_nom: e.nom_complet }),
    },
    { name: "employe_nom", label: "Employé", required: true },
    { name: "destination", label: "Destination" },
    { name: "objet", label: "Objet", type: "textarea" },
    { name: "date_debut", label: "Date début", type: "date" },
    { name: "date_fin", label: "Date fin", type: "date" },
    { name: "budget", label: "Budget (FCFA)", type: "money" },
    { name: "statut", label: "Statut", type: "select", options: statuts, default: "planifiee" },
  ],
};
