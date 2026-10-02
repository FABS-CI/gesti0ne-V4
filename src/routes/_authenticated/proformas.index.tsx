import { formatDocumentReference } from "@/lib/document-reference";
import { createFileRoute } from "@tanstack/react-router";
import { FileSignature, FileDown, Eye, Printer, Mail, ScanEye, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { ResourceManager, type ResourceConfig } from "@/components/crud/ResourceManager";
import { downloadBlob, fileNameFor } from "@/lib/pdf/fabsTemplates";
import { generateUnifiedCommercialPDF } from "@/lib/pdf/unified-generator";
import {
  loadProformaDocLignes,
  loadClientInfoForProforma,
  loadProformaTotals,
} from "@/lib/pdf/enrich-lignes";
import { printCached, viewCached, emailDoc } from "@/lib/pdf/actions";
import { getOrCreatePdf, pdfCacheKey, invalidatePdfByPrefix } from "@/lib/pdf/pdfCache";
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
      label: "Visualiser",
      icon: Eye,
      to: (row) => `/proformas/${row.proforma_id}`,
    },
    {
      label: "Aperçu PDF",
      icon: ScanEye,
      onClick: async (row) => {
        try {
          await viewCached(cacheKeyFor(row), () => buildProformaBlob(row));
        } catch (e) {
          toast.error(friendlyError(e, "Erreur aperçu"));
        }
      },
    },
    {
      label: "Télécharger PDF",
      icon: FileDown,
      onClick: async (row) => {
        try {
          const blob = await getOrCreatePdf(cacheKeyFor(row), () => buildProformaBlob(row));
          downloadBlob(blob, fileNameFor(row.reference as string, row.client_nom as string | null));
        } catch (e) {
          toast.error(friendlyError(e, "Erreur PDF"));
        }
      },
    },
    {
      label: "Imprimer",
      icon: Printer,
      onClick: async (row) => {
        try {
          await printCached(cacheKeyFor(row), () => buildProformaBlob(row));
        } catch (e) {
          toast.error(friendlyError(e, "Erreur impression"));
        }
      },
    },
    {
      label: "Régénérer le PDF",
      icon: RefreshCw,
      onClick: async (row) => {
        try {
          invalidatePdfByPrefix(`PF:${row.reference as string}:`);
          const blob = await getOrCreatePdf(cacheKeyFor(row), () => buildProformaBlob(row));
          downloadBlob(blob, fileNameFor(row.reference as string, row.client_nom as string | null));
          toast.success("Document régénéré avec le nouveau modèle");
        } catch (e) {
          toast.error(friendlyError(e, "Erreur régénération"));
        }
      },
    },
    {
      label: "Envoyer par email",
      icon: Mail,
      onClick: (row) =>
        emailDoc({
          subject: `Proforma ${formatDocumentReference(row.reference)} — FABS-CI`,
          body: `Bonjour,\n\nVeuillez trouver ci-joint la proforma ${formatDocumentReference(row.reference)}.\n\nCordialement,\nFABS-CI`,
        }),
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
