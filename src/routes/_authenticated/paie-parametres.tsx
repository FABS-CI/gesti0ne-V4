import { createFileRoute } from "@tanstack/react-router";
import { ResourceManager } from "@/components/crud/ResourceManager";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/paie-parametres")({
  component: () => (
    <ResourceManager
      config={{
        table: "paie_parametres",
        idField: "parametre_id",
        title: "Paramètres Paie CI",
        subtitle: "Barèmes CNPS / CMU / ITS / IGR / CN — configurables",
        newLabel: "Nouveau paramètre",
        entityLabel: "le paramètre",
        csvName: "paie_parametres",
        searchFields: ["code", "libelle"],
        columns: [
          { name: "categorie", label: "Catégorie" },
          { name: "code", label: "Code", type: "mono" },
          { name: "libelle", label: "Libellé" },
          { name: "valeur", label: "Valeur", type: "number", align: "right" },
          { name: "unite", label: "Unité" },
        ],
        fields: [
          { name: "code", label: "Code", required: true },
          { name: "libelle", label: "Libellé", required: true },
          { name: "valeur", label: "Valeur", type: "number", required: true },
          {
            name: "unite",
            label: "Unité",
            type: "select",
            options: [
              { value: "pourcentage", label: "Pourcentage (%)" },
              { value: "montant", label: "Montant (FCFA)" },
              { value: "plafond", label: "Plafond (FCFA)" },
            ],
          },
          {
            name: "categorie",
            label: "Catégorie",
            type: "select",
            options: [
              { value: "cnps", label: "CNPS" },
              { value: "cmu", label: "CMU" },
              { value: "its", label: "ITS" },
              { value: "igr", label: "IGR" },
              { value: "cn", label: "Contribution Nationale" },
              { value: "autre", label: "Autre" },
            ],
          },
          { name: "description", label: "Description", type: "textarea", colSpan: 2 },
        ],
      }}
    />
  ),
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});
