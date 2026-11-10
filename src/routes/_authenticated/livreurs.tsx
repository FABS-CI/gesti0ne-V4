import { createFileRoute } from "@tanstack/react-router";
import { User } from "lucide-react";
import { ResourceManager, type ResourceConfig } from "@/components/crud/ResourceManager";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

const config: ResourceConfig = {
  table: "livreurs",
  idField: "livreur_id",
  title: "Livreurs",
  overline: "Logistique",
  subtitle: "Fiche des livreurs (données logistiques — aucun accès à l'application)",
  icon: User,
  newLabel: "Nouveau livreur",
  entityLabel: "le livreur",
  csvName: "livreurs",
  searchFields: ["nom_complet", "telephone", "matricule", "permis"],
  columns: [
    { name: "matricule", label: "Matricule", type: "mono" },
    { name: "nom_complet", label: "Nom complet" },
    { name: "telephone", label: "Téléphone" },
    { name: "permis", label: "Permis" },
    {
      name: "actif",
      label: "Statut",
      type: "badge",
      options: [
        { value: "true", label: "Actif", color: "#10B981" },
        { value: "false", label: "Inactif", color: "#94A3B8" },
      ],
    },
  ],
  fields: [
    { name: "nom_complet", label: "Nom complet", required: true },
    { name: "matricule", label: "Matricule" },
    { name: "telephone", label: "Téléphone" },
    { name: "permis", label: "Permis (catégorie / n°)" },
    {
      name: "actif",
      label: "Actif",
      type: "select",
      options: [
        { value: "true", label: "Oui" },
        { value: "false", label: "Non" },
      ],
      default: "true",
    },
  ],
};

export const Route = createFileRoute("/_authenticated/livreurs")({
  component: () => <ResourceManager config={config} />,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});
