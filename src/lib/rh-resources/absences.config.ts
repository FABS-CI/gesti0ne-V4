import type { ResourceConfig } from "@/components/crud/ResourceManager";

const types = [
  { value: "maladie", label: "Maladie" },
  { value: "injustifiee", label: "Injustifiée" },
  { value: "autorisee", label: "Autorisée" },
  { value: "autre", label: "Autre" },
];

const statuts = [
  { value: "en_attente", label: "En attente", color: "#F97316" },
  { value: "validee", label: "Validée", color: "#10B981" },
  { value: "rejetee", label: "Rejetée", color: "#EF4444" },
];

export const absencesConfig: ResourceConfig = {
  table: "absences",
  idField: "absence_id",
  title: "Absences",
  subtitle: "Suivi des absences du personnel",
  newLabel: "Nouvelle absence",
  entityLabel: "l'absence",
  csvName: "absences",
  searchFields: ["employe_nom"],
  statusFilter: { field: "statut", options: statuts },
  newHref: "/absences/nouveau",
  editHref: (row) => `/absences/${row.absence_id}/modifier`,
  columns: [
    { name: "employe_nom", label: "Employé" },
    { name: "type_absence", label: "Type", type: "badge", options: types },
    { name: "date_debut", label: "Début" },
    { name: "date_fin", label: "Fin" },
    { name: "statut", label: "Statut", type: "badge", options: statuts },
  ],
  fields: [
    {
      name: "_employe_search",
      label: "Rechercher un employé",
      type: "employee-search",
      virtual: true,
      colSpan: 2,
      onSelectPatch: (e) => ({ employe_id: e.employe_id, employe_nom: e.nom_complet }),
    },
    { name: "employe_nom", label: "Employé", required: true, colSpan: 2 },
    { name: "type_absence", label: "Type", type: "select", options: types, default: "maladie" },
    { name: "statut", label: "Statut", type: "select", options: statuts, default: "en_attente" },
    { name: "date_debut", label: "Date début", type: "date" },
    { name: "date_fin", label: "Date fin", type: "date" },
    { name: "motif", label: "Motif", type: "textarea" },
  ],
};
