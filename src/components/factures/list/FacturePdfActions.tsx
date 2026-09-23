import { DocumentActions } from "@/components/documents/DocumentActions";
import {
  loadClientInfoForFacture,
  loadFactureDocLignes,
  loadFactureTotals,
} from "@/lib/pdf/enrich-lignes";
import { fileNameFor, generateFacturePDF } from "@/lib/pdf/fabsTemplates";
import { pdfCacheKey } from "@/lib/pdf/pdfCache";
import { deleteFactureDefinitif } from "@/lib/factures-api";
import { STATUT_FACTURE_LABEL } from "@/lib/factures-api";

type Facture = {
  facture_id: string;
  reference: string;
  client_nom: string | null;
  date_facture: string;
  montant_total: number | string;
  montant_paye: number | string;
  statut: string;
  updated_at?: string;
};

type PdfState = { loading: boolean; progress: number };

type Props = {
  facture: Facture;
  pdfState: PdfState;
};

export function FacturePdfActions({ facture: f, pdfState: st }: Props) {
  const buildBlob = async () => {
    const [lignes, clientInfo, totals] = await Promise.all([
      loadFactureDocLignes(f.facture_id),
      loadClientInfoForFacture(f.facture_id),
      loadFactureTotals(f.facture_id),
    ]);
    return generateFacturePDF({
      ...clientInfo,
      ...totals,
      id: f.facture_id,
      facture_id: f.facture_id,
      reference: f.reference,
      date: f.date_facture,
      clientNom: clientInfo.clientNom ?? f.client_nom,
      totalVente: totals.totalVente ?? Number(f.montant_total),
      montantHT: totals.montantHT ?? Number(f.montant_total),
      paye: Number(f.montant_paye),
      soldeDu: Number(f.montant_total) - Number(f.montant_paye),
      lignes,
      statut: STATUT_FACTURE_LABEL[f.statut]
        ? {
            label: STATUT_FACTURE_LABEL[f.statut].label,
            color: STATUT_FACTURE_LABEL[f.statut].color,
          }
        : null,
    });
  };
  const cacheKey = pdfCacheKey("FC", f.reference, f.updated_at ?? f.date_facture);
  return (
    <DocumentActions
      viewTo={`/factures/${f.facture_id}`}
      cacheKey={cacheKey}
      buildBlob={buildBlob}
      filename={fileNameFor(f.reference, f.client_nom)}
      emailSubject={`Facture ${f.reference} — FABS-CI`}
      emailBody={`Bonjour,\n\nVeuillez trouver ci-joint la facture ${f.reference}.\n\nCordialement,\nFABS-CI`}
      loading={st.loading}
      progress={st.progress}
      delete={{
        entityLabel: `la facture ${f.reference}`,
        onConfirm: () => deleteFactureDefinitif(f.facture_id),
        invalidateKeys: [["factures"]],
      }}
    />
  );
}
