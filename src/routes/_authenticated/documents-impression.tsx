import { createFileRoute } from "@tanstack/react-router";
import { ResourceManager, type ResourceConfig } from "@/components/crud/ResourceManager";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/documents-impression")({
  component: () => <ResourceManager config={config} />,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

const types = [
  { value: "facture", label: "Facture" },
  { value: "bon_commande", label: "Bon de commande" },
  { value: "bon_livraison", label: "Bon de livraison" },
  { value: "rapport", label: "Rapport" },
  { value: "autre", label: "Autre" },
];

const statuts = [
  { value: "actif", label: "Actif", color: "#10B981" },
  { value: "archive", label: "Archivé", color: "#64748B" },
];

const config: ResourceConfig = {
  table: "documents",
  idField: "document_id",
  title: "Documents & Impression",
  subtitle: "Registre documentaire",
  newLabel: "Nouveau document",
  entityLabel: "le document",
  csvName: "documents",
  searchFields: ["titre", "description"],
  statusFilter: { field: "type_document", options: types },
  columns: [
    { name: "titre", label: "Titre" },
    { name: "type_document", label: "Type", type: "badge", options: types },
    { name: "date_document", label: "Date" },
    { name: "statut", label: "Statut", type: "badge", options: statuts },
  ],
  fields: [
    { name: "titre", label: "Titre", required: true, colSpan: 2 },
    { name: "type_document", label: "Type", type: "select", options: types, default: "facture" },
    { name: "statut", label: "Statut", type: "select", options: statuts, default: "actif" },
    { name: "date_document", label: "Date", type: "date" },
    { name: "description", label: "Description", type: "textarea" },
  ],
};
