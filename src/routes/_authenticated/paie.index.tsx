import { createFileRoute } from "@tanstack/react-router";
import { FileDown, Wallet } from "lucide-react";
import { BulletinActionButtons } from "@/components/paie/BulletinActionButtons";
import { ResourceManager, type ResourceConfig } from "@/components/crud/ResourceManager";

import { authRouteHead } from "@/lib/route-head";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
export const Route = createFileRoute("/_authenticated/paie/")({
  head: () => authRouteHead("Paie"),
  component: () => <ResourceManager config={config} />,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

const statuts = [
  { value: "brouillon", label: "Brouillon", color: "#64748B" },
  { value: "genere", label: "Généré", color: "#3B82F6" },
  { value: "valide", label: "Validé", color: "#10B981" },
  { value: "paye", label: "Payé", color: "#14B8A6" },
];

const config: ResourceConfig = {
  table: "bulletins_paie",
  idField: "bulletin_id",
  title: "Paie",
  subtitle: "Bulletins de salaire",
  icon: Wallet,
  newLabel: "Nouveau bulletin",
  entityLabel: "le bulletin",
  csvName: "bulletins_paie",
  searchFields: ["employe_nom", "periode"],
  newHref: "/paie/nouveau",
  statusFilter: { field: "statut", options: statuts },
  periodFilter: { field: "periode" },
  syncFiltersToUrl: true,
  summary: { label: "bulletins", sumField: "salaire_net", sumLabel: "Total des nets" },
  advancedFilters: {
    fields: ["client", "dates", "montants"],
    columns: { client: "employe_nom", date: "created_at", montant: "salaire_net" },
  },
  rowActions: [
    {
      label: "Valider / Télécharger",
      icon: FileDown,
      render: (row) => <BulletinActionButtons bulletinId={String(row.bulletin_id)} statut={row.statut} size="icon" />,
    },
  ],
  columns: [
    { name: "employe_nom", label: "Employé" },
    { name: "periode", label: "Période" },
    { name: "salaire_brut", label: "Brut", type: "money", align: "right" },
    { name: "retenues", label: "Retenues", type: "money", align: "right" },
    { name: "salaire_net", label: "Net", type: "money", align: "right" },
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
    { name: "periode", label: "Période (ex: Juin 2026)", required: true, colSpan: 2 },
    { name: "salaire_brut", label: "Salaire brut (FCFA)", type: "money" },
    { name: "retenues", label: "Retenues (FCFA)", type: "money" },
    { name: "salaire_net", label: "Salaire net (FCFA)", type: "money" },
    { name: "statut", label: "Statut", type: "select", options: statuts, default: "genere" },
  ],
};
