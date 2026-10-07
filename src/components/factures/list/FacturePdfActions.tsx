import { useState } from "react";
import { toast } from "sonner";
import { Receipt, Truck, CircleDollarSign, Loader2 } from "lucide-react";
import { friendlyError } from "@/lib/friendly-error";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/use-permissions";
import { SuperAdminDeleteButton } from "@/components/documents/SuperAdminDeleteButton";
import { SolderFactureDialog } from "@/components/commandes/SolderFactureDialog";
import { downloadBLFor } from "@/lib/commandes-pdf-actions";
import {
  loadClientInfoForFacture,
  loadFactureDocLignes,
  loadFactureTotals,
} from "@/lib/pdf/enrich-lignes";
import { downloadBlob, fileNameFor, generateFacturePDF } from "@/lib/pdf/fabsTemplates";
import { getOrCreatePdf, pdfCacheKey } from "@/lib/pdf/pdfCache";
import { deleteFactureDefinitif, STATUT_FACTURE_LABEL } from "@/lib/factures-api";

type Facture = {
  facture_id: string;
  reference: string;
  client_nom: string | null;
  commande_id?: string | null;
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

/**
 * Actions d'une ligne de facture, alignées comme dans Commandes :
 * FAC (téléchargement direct), BL (téléchargement direct), Solder, Supprimer.
 */
export function FacturePdfActions({ facture: f, pdfState: st }: Props) {
  const { has, isLoading: permsLoading } = usePermissions();
  const canPayer = !permsLoading && has("paiements.creer");
  const [solderOpen, setSolderOpen] = useState(false);
  const reste = Number(f.montant_total) - Number(f.montant_paye);
  const commandeId = f.commande_id ?? null;
  const showSolder = canPayer && !!commandeId && reste > 0 && f.statut !== "annulee";

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
      soldeDu: reste,
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

  const downloadFacture = async () => {
    try {
      const blob = await getOrCreatePdf(cacheKey, buildBlob);
      downloadBlob(blob, fileNameFor(f.reference, f.client_nom));
    } catch (e) {
      toast.error(friendlyError(e, "Erreur téléchargement"));
    }
  };

  return (
    <div className="flex flex-nowrap items-center justify-end gap-1 whitespace-nowrap">
      <Button
        variant="outline"
        size="sm"
        className="h-8 px-2"
        disabled={st.loading}
        title="Télécharger la facture (PDF)"
        aria-label="Télécharger la facture (PDF)"
        onClick={downloadFacture}
      >
        {st.loading ? (
          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
        ) : (
          <Receipt className="mr-1 h-4 w-4" />
        )}{" "}
        FAC
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-8 px-2"
        disabled={!commandeId}
        title={commandeId ? "Télécharger le bon de livraison (PDF)" : "Aucune commande liée"}
        aria-label="Télécharger le bon de livraison (PDF)"
        onClick={() =>
          commandeId &&
          downloadBLFor({
            commande_id: commandeId,
            client_nom: f.client_nom,
            montant_total: Number(f.montant_total),
          })
        }
      >
        <Truck className="mr-1 h-4 w-4" /> BL
      </Button>
      {showSolder && (
        <Button
          variant="ghost"
          size="icon"
          title="Solder la facture"
          aria-label="Solder la facture"
          onClick={() => setSolderOpen(true)}
        >
          <CircleDollarSign className="h-5 w-5 text-accent-foreground" />
        </Button>
      )}
      <SuperAdminDeleteButton
        entityLabel={`la facture ${f.reference}`}
        onConfirm={() => deleteFactureDefinitif(f.facture_id)}
        invalidateKeys={[["factures"]]}
      />
      {solderOpen && commandeId && (
        <SolderFactureDialog
          commande={{ commande_id: commandeId, client_nom: f.client_nom }}
          open={solderOpen}
          onOpenChange={setSolderOpen}
        />
      )}
    </div>
  );
}
