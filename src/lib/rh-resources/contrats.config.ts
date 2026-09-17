import { FileText } from "lucide-react";
import type { ResourceConfig } from "@/components/crud/ResourceManager";

const types = [
  { value: "cdi", label: "CDI" },
  { value: "cdd", label: "CDD" },
  { value: "stage", label: "Stage" },
  { value: "prestation", label: "Prestation" },
];

const statuts = [
  { value: "actif", label: "Actif", color: "#10B981" },
  { value: "expire", label: "Expiré", color: "#64748B" },
  { value: "resilie", label: "Résilié", color: "#EF4444" },
];

export const contratsConfig: ResourceConfig = {
  table: "contrats",
  idField: "contrat_id",
  title: "Contrats",
  subtitle: "Contrats des employés",
  icon: FileText,
  newLabel: "Nouveau contrat",
  entityLabel: "le contrat",
  csvName: "contrats",
  searchFields: ["employe_nom"],
  statusFilter: { field: "statut", options: statuts },
  newHref: "/contrats/nouveau",
  editHref: (row) => `/contrats/${row.contrat_id}/modifier`,
  columns: [
    { name: "employe_nom", label: "Employé" },
    { name: "type", label: "Type", type: "badge", options: types },
    { name: "date_debut", label: "Début" },
    { name: "date_fin", label: "Fin" },
    { name: "salaire", label: "Salaire", type: "money", align: "right" },
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
    { name: "type", label: "Type", type: "select", options: types, default: "cdi" },
    { name: "statut", label: "Statut", type: "select", options: statuts, default: "actif" },
    { name: "date_debut", label: "Date début", type: "date" },
    { name: "date_fin", label: "Date fin", type: "date" },
    { name: "salaire", label: "Salaire (FCFA)", type: "money" },
    { name: "notes", label: "Notes", type: "textarea" },
  ],
};
