import type { ResourceConfig } from "@/components/crud/ResourceManager";

export const evaluationsConfig: ResourceConfig = {
  table: "evaluations",
  idField: "evaluation_id",
  title: "Évaluations",
  subtitle: "Évaluations de performance du personnel",
  newLabel: "Nouvelle évaluation",
  entityLabel: "l'évaluation",
  csvName: "evaluations",
  searchFields: ["employe_nom", "periode"],
  newHref: "/evaluations/nouveau",
  editHref: (row) => `/evaluations/${row.evaluation_id}/modifier`,
  columns: [
    { name: "employe_nom", label: "Employé" },
    { name: "periode", label: "Période" },
    { name: "note", label: "Note /20", align: "right" },
    { name: "date_evaluation", label: "Date" },
    { name: "commentaire", label: "Commentaire" },
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
    { name: "periode", label: "Période (ex: 2026 S1)" },
    { name: "note", label: "Note /20", type: "number" },
    { name: "date_evaluation", label: "Date", type: "date" },
    { name: "commentaire", label: "Commentaire", type: "textarea" },
  ],
};
