import { createFileRoute } from "@tanstack/react-router";
import { ResourceManager, type ResourceConfig } from "@/components/crud/ResourceManager";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/fleet")({
  component: () => <ResourceManager config={config} />,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

const types = [
  { value: "camion", label: "Camion" },
  { value: "camionnette", label: "Camionnette" },
  { value: "voiture", label: "Voiture" },
  { value: "moto", label: "Moto" },
];

const statuts = [
  { value: "disponible", label: "Disponible", color: "#10B981" },
  { value: "en_mission", label: "En mission", color: "#3B82F6" },
  { value: "maintenance", label: "Maintenance", color: "#F97316" },
  { value: "hors_service", label: "Hors service", color: "#EF4444" },
];

const config: ResourceConfig = {
  table: "vehicules",
  idField: "vehicule_id",
  title: "Flotte",
  subtitle: "Parc automobile de l'entreprise",
  newLabel: "Nouveau véhicule",
  entityLabel: "le véhicule",
  csvName: "vehicules",
  searchFields: ["immatriculation", "marque", "modele"],
  statusFilter: { field: "statut", options: statuts },
  columns: [
    { name: "immatriculation", label: "Immatriculation", type: "mono" },
    { name: "marque", label: "Marque" },
    { name: "modele", label: "Modèle" },
    { name: "type_vehicule", label: "Type", type: "badge", options: types },
    { name: "kilometrage", label: "Km", align: "right" },
    { name: "date_prochain_entretien", label: "Entretien", type: "date" },
    { name: "date_expiration_assurance", label: "Assurance", type: "date" },
    { name: "date_expiration_visite_technique", label: "Visite tech.", type: "date" },
    { name: "statut", label: "Statut", type: "badge", options: statuts },
  ],
  fields: [
    { name: "immatriculation", label: "Immatriculation", required: true },
    { name: "type_vehicule", label: "Type", type: "select", options: types, default: "camion" },
    { name: "marque", label: "Marque" },
    { name: "modele", label: "Modèle" },
    { name: "kilometrage", label: "Kilométrage", type: "number" },
    { name: "date_prochain_entretien", label: "Prochain entretien", type: "date" },
    { name: "date_expiration_assurance", label: "Expiration assurance", type: "date" },
    {
      name: "date_expiration_visite_technique",
      label: "Expiration visite technique",
      type: "date",
    },
    { name: "statut", label: "Statut", type: "select", options: statuts, default: "disponible" },
    { name: "notes", label: "Notes", type: "textarea" },
  ],
};
