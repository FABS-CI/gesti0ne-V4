import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRightLeft,
  Send,
  CheckCircle,
  XCircle,
  ScanEye,
  Printer,
  Download,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { generateBonTransfertPDF } from "@/lib/pdf/fabsTemplates";
import { printCached, viewCached } from "@/lib/pdf/actions";
import { pdfCacheKey, getOrCreatePdf } from "@/lib/pdf/pdfCache";

import {
  getTransfert,
  getTransfertLignes,
  executerTransfert,
  receptionnerTransfert,
  annulerTransfert,
  type Transfert,
} from "@/lib/depots-api";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Can } from "@/components/rbac/Can";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { friendlyError } from "@/lib/friendly-error";

export const Route = createFileRoute("/_authenticated/transferts/$transfertId")({
  component: TransfertDetailPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

const labels: Record<Transfert["statut"], string> = {
  brouillon: "Brouillon",
  expedie: "Expédié",
  recu: "Reçu",
  annule: "Annulé",
};
const colors: Record<Transfert["statut"], "default" | "secondary" | "destructive"> = {
  brouillon: "secondary",
  expedie: "default",
  recu: "default",
  annule: "destructive",
};

function TransfertDetailPage() {
  const { transfertId } = Route.useParams();
  const qc = useQueryClient();

  const { data: transfert } = useQuery({
    queryKey: ["transfert", transfertId],
    queryFn: () => getTransfert(transfertId),
  });

  const { data: lignes = [] } = useQuery({
    queryKey: ["transfert-lignes", transfertId],
    queryFn: () => getTransfertLignes(transfertId),
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["transfert", transfertId] });
    qc.invalidateQueries({ queryKey: ["transferts"] });
  }

  const expedier = useMutation({
    mutationFn: () => executerTransfert(transfertId),
    onSuccess: () => {
      toast.success("Transfert expédié, stocks mis à jour");
      invalidate();
    },
    onError: (e: unknown) => toast.error(friendlyError(e, "Erreur")),
  });

  const receptionner = useMutation({
    mutationFn: () => receptionnerTransfert(transfertId),
    onSuccess: () => {
      toast.success("Transfert réceptionné");
      invalidate();
    },
    onError: (e: unknown) => toast.error(friendlyError(e, "Erreur")),
  });

  const annuler = useMutation({
    mutationFn: () => annulerTransfert(transfertId),
    onSuccess: () => {
      toast.success("Transfert annulé");
      invalidate();
    },
    onError: (e: unknown) => toast.error(friendlyError(e, "Erreur")),
  });

  if (!transfert) {
    return <div className="text-muted-foreground">Chargement...</div>;
  }

  const buildBlob = async () =>
    generateBonTransfertPDF({
      reference: transfert.numero,
      date: transfert.date_creation,
      clientNom: transfert.destination?.nom ?? "—",
      codeClient: transfert.source?.nom ? `Depuis ${transfert.source.nom}` : undefined,
      representant: transfert.transporteur ?? undefined,
      lignes: lignes.map((l) => ({
        codeArticle: l.produits?.reference ?? undefined,
        reference: l.produits?.titre ?? "—",
        qte: Number(l.quantite),
      })),
    });
  const cacheKey = pdfCacheKey(
    "BT",
    transfert.numero,
    (transfert as unknown as { updated_at?: string }).updated_at,
  );
  const handleView = async () => {
    try {
      await viewCached(cacheKey, buildBlob);
    } catch (e) {
      toast.error(friendlyError(e, "Erreur aperçu"));
    }
  };
  const handlePrint = async () => {
    try {
      await printCached(cacheKey, buildBlob);
    } catch (e) {
      toast.error(friendlyError(e, "Erreur impression"));
    }
  };
  const handleDownload = async () => {
    try {
      const blob = await getOrCreatePdf(cacheKey, buildBlob);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bon_transfert_${transfert.numero}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      toast.error(friendlyError(e, "Erreur téléchargement"));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-3">
            <Link to="/transferts">
              <ArrowLeft className="mr-2 h-4 w-4" /> Retour
            </Link>
          </Button>
          <h1 className="ds-page-title flex items-center gap-2">
            <ArrowRightLeft className="h-6 w-6 text-primary" />
            <span className="font-mono">{transfert.numero}</span>
            <Badge variant={colors[transfert.statut]}>{labels[transfert.statut]}</Badge>
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleView}>
            <ScanEye className="mr-2 h-4 w-4" /> Aperçu
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" /> Imprimer
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" /> Télécharger
          </Button>
          {transfert.statut === "brouillon" && (
            <>
              <Can permission="transferts.executer">
                <Button onClick={() => expedier.mutate()} disabled={expedier.isPending}>
                  <Send className="mr-2 h-4 w-4" /> Expédier
                </Button>
              </Can>
              <Can permission="transferts.annuler">
                <Button variant="outline" onClick={() => annuler.mutate()}>
                  <XCircle className="mr-2 h-4 w-4" /> Annuler
                </Button>
              </Can>
            </>
          )}
          {transfert.statut === "expedie" && (
            <Can permission="transferts.receptionner">
              <Button onClick={() => receptionner.mutate()} disabled={receptionner.isPending}>
                <CheckCircle className="mr-2 h-4 w-4" /> Réceptionner
              </Button>
            </Can>
          )}
        </div>
      </div>

      <div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
        <Info label="Source" value={transfert.source?.nom ?? "—"} />
        <Info label="Destination" value={transfert.destination?.nom ?? "—"} />
        <Info
          label="Créé le"
          value={format(new Date(transfert.date_creation), "dd/MM/yyyy HH:mm")}
        />
        <Info
          label="Expédié le"
          value={
            transfert.date_expedition
              ? format(new Date(transfert.date_expedition), "dd/MM/yyyy HH:mm")
              : "—"
          }
        />
        <Info label="Transporteur" value={transfert.transporteur ?? "—"} />
        <Info label="Motif" value={transfert.motif ?? "—"} />
        {transfert.notes && (
          <div className="sm:col-span-2">
            <div className="text-xs text-muted-foreground">Notes</div>
            <div className="text-sm">{transfert.notes}</div>
          </div>
        )}
      </div>

      <div className="rounded-lg border">
        <div className="p-4 font-semibold">Produits ({lignes.length})</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Référence</TableHead>
              <TableHead>Titre</TableHead>
              <TableHead className="text-right">Quantité</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lignes.map((l) => (
              <TableRow key={l.ligne_id}>
                <TableCell className="font-mono text-sm select-all" title="Référence produit">{l.produits?.reference ?? "—"}</TableCell>
                <TableCell>{l.produits?.titre ?? "—"}</TableCell>
                <TableCell className="text-right font-medium">{l.quantite}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
