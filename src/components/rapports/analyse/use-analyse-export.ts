import { useState } from "react";
import { toast } from "sonner";
import { exportXlsx, type AgregatDim, type RapportFilters } from "@/lib/rapports-api";
import {
  PRODUITS_HEADERS,
  fetchAllProduitsRapport,
  produitsRowsForExport,
} from "@/lib/rapports-analyse-helpers";
import { formatFCFA, formatNumber } from "@/lib/format";
import { formatPeriodeLabel } from "@/lib/rapports-periode";

const ERREUR = "L'export n'a pas pu être réalisé. Réessayez ou contactez l'administrateur.";

/** Exports de la zone d'analyse : produits complets (par lots) ou dimension affichée. */
export function useAnalyseExport() {
  const [progress, setProgress] = useState<string | null>(null);

  const exportProduits = async (
    kind: "xlsx" | "pdf",
    filters: RapportFilters,
    tri: string,
    sens: "asc" | "desc",
  ) => {
    setProgress("0 ligne");
    try {
      const all = await fetchAllProduitsRapport(filters, tri, sens, (n, t) =>
        setProgress(`${formatNumber(n)} / ${formatNumber(t)}`),
      );
      if (kind === "xlsx") {
        await exportXlsx("rapport_produits", PRODUITS_HEADERS, produitsRowsForExport(all));
      } else {
        const { exportRapportProduitsPdf } = await import("@/lib/pdf/rapport-produits-pdf");
        await exportRapportProduitsPdf(all, {
          periode: formatPeriodeLabel(filters.from, filters.to),
          filtres: [
            { label: "Niveaux", value: (filters.niveaux ?? []).join(", ") },
            { label: "Catégories", value: (filters.categories ?? []).join(", ") },
            { label: "Types", value: (filters.types ?? []).join(", ") },
            { label: "Villes", value: (filters.villes ?? []).join(", ") },
            { label: "Produits", value: filters.produits?.length ? `${filters.produits.length} sélectionné(s)` : "" },
          ],
        });
      }
      toast.success(`${formatNumber(all.length)} lignes exportées`);
    } catch {
      toast.error(ERREUR);
    } finally {
      setProgress(null);
    }
  };

  const exportDimension = async (
    kind: "xlsx" | "pdf",
    title: string,
    rows: AgregatDim[],
    labelOf: (v: string) => string,
    filters: RapportFilters,
  ) => {
    const headers = ["Libellé", "Quantité", "CA", "Clients", "Factures", "Produits"];
    const sorted = [...rows].sort((a, b) => Number(b.ca) - Number(a.ca));
    try {
      if (kind === "xlsx") {
        await exportXlsx(
          title,
          headers,
          sorted.map((d) => [labelOf(d.label), d.qte, d.ca, d.nb_clients, d.nb_factures, d.nb_produits]),
        );
      } else {
        const { exportListePDF } = await import("@/lib/pdf/exportListe");
        await exportListePDF({
          titre: title,
          colonnes: headers,
          lignes: sorted.map((d) => [
            labelOf(d.label),
            d.qte,
            formatFCFA(d.ca),
            d.nb_clients,
            d.nb_factures,
            d.nb_produits,
          ]),
          filtres: [`Période : ${formatPeriodeLabel(filters.from, filters.to)}`],
          filename: title,
        });
      }
      toast.success(`${formatNumber(sorted.length)} lignes exportées`);
    } catch {
      toast.error(ERREUR);
    }
  };

  return { progress, exportProduits, exportDimension };
}
