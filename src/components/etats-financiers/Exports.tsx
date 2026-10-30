// Exports du dossier : classeur Excel rempli à partir du modèle de liasse déposé
// dans l'ERP, et dossier PDF complet. Les exports portent sur les états affichés :
// la version enregistrée consultée, sinon les données actuelles.

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, FileText, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePermissions } from "@/hooks/use-permissions";
import { chargerModele, deposerModele, getModeleActif } from "@/lib/etats-financiers/donnees-api";
import {
  anneeExport,
  exporterPdf,
  identiteExport,
  type DonneesExport,
} from "@/lib/etats-financiers/exports";
import { downloadBlob } from "@/lib/fec-helpers";
import { formatDateTime } from "@/lib/format";
import { friendlyError } from "@/lib/friendly-error";

export function ExportsDossier({ donnees }: { donnees: DonneesExport }) {
  const { has } = usePermissions();
  const qc = useQueryClient();
  const fichierRef = useRef<HTMLInputElement>(null);
  const [envoi, setEnvoi] = useState<"depot" | "excel" | "pdf" | null>(null);
  const qModele = useQuery({ queryKey: ["etats-financiers-modele"], queryFn: getModeleActif });
  const modele = qModele.data;
  const bloquants = donnees.controles.filter((c) => c.niveau === "bloquant").length;

  async function deposer(file: File) {
    setEnvoi("depot");
    try {
      if (!/\.xls[xm]$/i.test(file.name)) throw new Error("Fichier .xlsx ou .xlsm attendu.");
      await deposerModele(file);
      toast.success(`Modèle « ${file.name} » déposé.`);
      await qc.invalidateQueries({ queryKey: ["etats-financiers-modele"] });
    } catch (e) {
      toast.error(friendlyError(e, "Dépôt du modèle refusé"));
    } finally {
      setEnvoi(null);
    }
  }

  async function excel() {
    if (!modele) return;
    setEnvoi("excel");
    try {
      const [{ remplirModele, nomFichierExcel }, contenu] = await Promise.all([
        import("@/lib/etats-financiers/excel-modele"),
        chargerModele(modele),
      ]);
      const { fichier, macros, rapport } = await remplirModele({
        modele: contenu,
        n: donnees.n,
        n1: donnees.n1,
        exercice: donnees.exercice,
        identite: identiteExport(donnees.identite),
        informations: [
          ["Dossier", donnees.version ?? "Données actuelles, non enregistrées"],
          ["Modèle", `${modele.nom_fichier} (déposé le ${formatDateTime(modele.depose_le)})`],
          ["Exporté le", formatDateTime(new Date())],
        ],
      });
      downloadBlob(
        new Blob([fichier], {
          type: macros
            ? "application/vnd.ms-excel.sheet.macroEnabled.12"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        nomFichierExcel(anneeExport(donnees), macros),
      );
      const reste = rapport.feuillesAVerifier.length;
      const msg = `Classeur exporté : ${rapport.cellules} cellules mises à jour, dont ${rapport.notesRemplies.length} note(s) annexe(s).${reste ? ` ${reste} feuille(s) (autres notes, fiches) restent à compléter : voir la feuille « ERP - LISEZ-MOI ».` : ""}`;
      const alertes = [
        ...(rapport.hypotheses.length
          ? [`Hypothèses à vérifier : ${rapport.hypotheses.join(" ")}`]
          : []),
        ...(rapport.introuvables.length
          ? [`Non placés dans le modèle : ${rapport.introuvables.join(", ")}.`]
          : []),
      ];
      if (alertes.length) toast.warning([msg, ...alertes].join(" "), { duration: 15000 });
      else toast.success(msg);
    } catch (e) {
      toast.error(friendlyError(e, "Export Excel impossible"));
    } finally {
      setEnvoi(null);
    }
  }

  async function pdf() {
    setEnvoi("pdf");
    try {
      await exporterPdf(donnees);
    } catch (e) {
      toast.error(friendlyError(e, "Export PDF impossible"));
    } finally {
      setEnvoi(null);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Exports du dossier</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-2">
          <Button onClick={pdf} disabled={!!envoi}>
            <FileText className="mr-2 h-4 w-4" /> Exporter en PDF (dossier complet)
          </Button>
          <Button variant="outline" onClick={excel} disabled={!!envoi || !modele}>
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Exporter en Excel
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {donnees.version
            ? `Exporte la ${donnees.version.toLowerCase()} du dossier.`
            : "Exporte les données actuelles : générer le dossier pour en garder une version datée."}
          {bloquants
            ? ` Attention : ${bloquants} contrôle(s) bloquant(s), le dossier ne doit pas être déposé en l'état.`
            : ""}
        </p>

        <div className="space-y-2 rounded-md border p-3">
          <p className="font-medium">Modèle Excel de la liasse</p>
          {modele ? (
            <p className="text-muted-foreground">
              {modele.nom_fichier} — déposé le {formatDateTime(modele.depose_le)}
              {modele.avec_macros ? " — macros conservées dans l'export (.xlsm)" : ""}.
            </p>
          ) : (
            <p className="text-muted-foreground">
              Aucun modèle déposé : l'export Excel a besoin du classeur de référence (par exemple «
              EDITION FABS-CI 2025.xlsm »). Il est conservé dans l'ERP, dans un espace privé.
            </p>
          )}
          {has("exercices.modifier") && (
            <>
              <input
                ref={fichierRef}
                type="file"
                accept=".xlsx,.xlsm"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void deposer(f);
                }}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!!envoi}
                onClick={() => fichierRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                {modele ? "Déposer un nouveau modèle" : "Déposer le modèle"}
              </Button>
            </>
          )}
          <p className="text-xs text-muted-foreground">
            L'export remplit le bilan, le compte de résultat, le TFT, 27 notes annexes calculées
            depuis la comptabilité (3A à 3D, 4 à 11, 14, 15A, 16A, 17 à 27A, 29) et les en-têtes ;
            formules, mise en page, zones d'impression et macros du modèle sont conservées. Les
            autres notes et les fiches R restent à compléter : la feuille « ERP - LISEZ-MOI » les
            liste, avec les hypothèses faites.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
