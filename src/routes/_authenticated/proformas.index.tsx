import { createFileRoute } from "@tanstack/react-router";
import { FileSignature, FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ResourceManager, type ResourceConfig } from "@/components/crud/ResourceManager";
import { downloadBlob, fileNameFor } from "@/lib/pdf/fabsTemplates";
import { generateUnifiedCommercialPDF } from "@/lib/pdf/unified-generator";
import {
  loadProformaDocLignes,
  loadClientInfoForProforma,
  loadProformaTotals,
} from "@/lib/pdf/enrich-lignes";
import { getOrCreatePdf, pdfCacheKey } from "@/lib/pdf/pdfCache";
import { SuperAdminDeleteButton } from "@/components/documents/SuperAdminDeleteButton";
import { deleteProformaDefinitif } from "@/lib/proformas-api";

import { authRouteHead } from "@/lib/route-head";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { friendlyError } from "@/lib/friendly-error";
async function buildProformaBlob(row: Record<string, unknown>): Promise<Blob> {
  const proformaId = row.proforma_id as string;
  const [lignes, clientInfo, totals] = await Promise.all([
    loadProformaDocLignes(proformaId),
    loadClientInfoForProforma(proformaId),
    loadProformaTotals(proformaId),
  ]);
  return generateUnifiedCommercialPDF("Proforma", {
    ...clientInfo,
    ...totals,
    id: proformaId,
    proforma_id: proformaId,
    reference: row.reference as string,
    date: row.date_proforma as string,
    clientNom: clientInfo.clientNom ?? (row.client_nom as string) ?? null,
    totalVente: totals.totalVente ?? Number(row.montant_total),
    montantHT: totals.montantHT ?? Number(row.montant_total),
    lignes,
  });
}

function cacheKeyFor(row: Record<string, unknown>) {
  return pdfCacheKey(
    "PF",
    row.reference as string,
    (row.updated_at as string | undefined) ?? (row.date_proforma as string | undefined),
  );
}

export const Route = createFileRoute("/_authenticated/proformas/")({
  head: () => authRouteHead("Proformas"),
  component: () => <ResourceManager config={config} />,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

const config: ResourceConfig = {
  table: "proformas",
  idField: "proforma_id",
  title: "Proformas",
  subtitle: "Proformas générées automatiquement à l'enregistrement d'une commande",
  icon: FileSignature,
  newLabel: "Nouvelle proforma",
  readOnly: true,
  entityLabel: "la proforma",
  csvName: "proformas",
  hideCsvExport: true,
  searchFields: ["reference", "client_nom"],
  advancedFilters: {
    fields: [
      "reference",
      "commande",
      "client",
      "telephone",
      "commercial",
      "ville",
      "dates",
      "montants",
    ],
    columns: { date: "date_proforma" },
    joins: {
      client: { fk: "client_id" },
      commande: { fk: "commande_id" },
    },
  },
  pdfExport: { title: "Liste des proformas", filename: "proformas" },
  columns: [
    { name: "reference", label: "Référence", type: "mono" },
    { name: "date_proforma", label: "Date" },
    { name: "client_nom", label: "Client" },
    { name: "montant_total", label: "Montant", type: "money", align: "right" },
  ],
  fields: [
    { name: "client_nom", label: "Client", required: true, colSpan: 2 },
    { name: "date_proforma", label: "Date", type: "date" },
    { name: "date_validite", label: "Validité", type: "date" },
    { name: "montant_total", label: "Montant (FCFA)", type: "money" },
    { name: "notes", label: "Notes", type: "textarea" },
  ],
  rowActions: [
    {
      label: "Télécharger la proforma (PDF)",
      icon: FileText,
      render: (row) => (
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2"
          title="Télécharger la proforma (PDF)"
          aria-label="Télécharger la proforma (PDF)"
          onClick={async () => {
            try {
              const blob = await getOrCreatePdf(cacheKeyFor(row), () => buildProformaBlob(row));
              downloadBlob(blob, fileNameFor(row.reference as string, row.client_nom as string | null));
            } catch (e) {
              toast.error(friendlyError(e, "Erreur PDF"));
            }
          }}
        >
          <FileText className="mr-1 h-4 w-4" /> PF
        </Button>
      ),
    },
    {
      label: "Supprimer définitivement",
      icon: Trash2,
      render: (row) => (
        <SuperAdminDeleteButton
          entityLabel={`la proforma ${row.reference as string}`}
          onConfirm={() => deleteProformaDefinitif(row.proforma_id as string)}
          invalidateKeys={[["proformas"]]}
        />
      ),
    },
  ],
};
