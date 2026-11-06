import { createFileRoute } from "@tanstack/react-router";
import { ResourceManager } from "@/components/crud/ResourceManager";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/paie-rubriques")({
  component: () => (
    <ResourceManager
      config={{
        table: "paie_rubriques",
        idField: "rubrique_id",
        title: "Rubriques Paie",
        subtitle: "Gains, retenues et charges patronales personnalisables",
        newLabel: "Nouvelle rubrique",
        entityLabel: "la rubrique",
        csvName: "paie_rubriques",
        searchFields: ["code", "libelle"],
        columns: [
          { name: "ordre", label: "#", type: "number", align: "right" },
          { name: "code", label: "Code", type: "mono" },
          { name: "libelle", label: "Libellé" },
          { name: "type", label: "Type" },
          { name: "mode_calcul", label: "Mode" },
          { name: "taux", label: "Taux", type: "number", align: "right" },
          { name: "montant_fixe", label: "Montant", type: "money", align: "right" },
          { name: "soumis_cnps", label: "CNPS" },
          { name: "soumis_its", label: "ITS" },
          { name: "soumis_igr", label: "IGR" },
        ],
        fields: [
          { name: "code", label: "Code", required: true },
          { name: "libelle", label: "Libellé", required: true },
          {
            name: "type",
            label: "Type",
            type: "select",
            options: [
              { value: "gain", label: "Gain" },
              { value: "retenue", label: "Retenue" },
              { value: "patronale", label: "Charge patronale" },
            ],
          },
          {
            name: "mode_calcul",
            label: "Mode de calcul",
            type: "select",
            options: [
              { value: "fixe", label: "Montant fixe" },
              { value: "pourcentage", label: "% de la base" },
              { value: "formule", label: "Formule (moteur)" },
            ],
          },
          {
            name: "base",
            label: "Base de calcul",
            type: "select",
            options: [
              { value: "salaire_base", label: "Salaire de base" },
              { value: "salaire_brut", label: "Salaire brut" },
              { value: "salaire_imposable", label: "Salaire imposable" },
            ],
          },
          { name: "taux", label: "Taux (%)", type: "number" },
          { name: "montant_fixe", label: "Montant fixe (FCFA)", type: "money" },
          { name: "ordre", label: "Ordre d'affichage", type: "number" },
          {
            name: "soumis_cnps",
            label: "Soumis à cotisations CNPS",
            type: "select",
            options: [
              { value: "true", label: "Oui" },
              { value: "false", label: "Non" },
            ],
          },
          {
            name: "soumis_its",
            label: "Soumis à l'ITS",
            type: "select",
            options: [
              { value: "true", label: "Oui" },
              { value: "false", label: "Non" },
            ],
          },
          {
            name: "soumis_igr",
            label: "Soumis à l'IGR",
            type: "select",
            options: [
              { value: "true", label: "Oui" },
              { value: "false", label: "Non" },
            ],
          },
          {
            name: "actif",
            label: "Rubrique active",
            type: "select",
            options: [
              { value: "true", label: "Oui" },
              { value: "false", label: "Non" },
            ],
          },
          { name: "description", label: "Description", type: "textarea", colSpan: 2 },
        ],
        validate: (row) => {
          const errs: string[] = [];
          const type = String(row.type ?? "");
          const mode = String(row.mode_calcul ?? "");
          const taux = Number(row.taux ?? 0);
          const montant = Number(row.montant_fixe ?? 0);
          const base = String(row.base ?? "");
          const isYes = (v: unknown) => v === true || v === "true";
          const cnps = isYes(row.soumis_cnps);
          const its = isYes(row.soumis_its);
          const igr = isYes(row.soumis_igr);

          if (mode === "pourcentage") {
            if (!(taux > 0)) errs.push("Mode « % de la base » : le taux doit être > 0.");
            if (!base) errs.push("Mode « % de la base » : la base de calcul est obligatoire.");
          }
          if (mode === "fixe" && !(montant > 0)) {
            errs.push("Mode « Montant fixe » : le montant fixe doit être > 0.");
          }
          if ((cnps || its || igr) && type !== "gain") {
            errs.push(
              "Les indicateurs Soumis CNPS/ITS/IGR ne s'appliquent qu'à une rubrique de type « Gain ».",
            );
          }
          if ((cnps || its || igr) && !base && mode !== "fixe") {
            errs.push(
              "Une rubrique soumise à CNPS/ITS/IGR doit préciser une base de calcul (ou être en montant fixe).",
            );
          }
          if (type === "retenue" && (cnps || its || igr)) {
            errs.push(
              "Une retenue ne peut pas être marquée Soumise à CNPS/ITS/IGR (assiette = gains).",
            );
          }
          return errs;
        },
      }}
    />
  ),
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});
