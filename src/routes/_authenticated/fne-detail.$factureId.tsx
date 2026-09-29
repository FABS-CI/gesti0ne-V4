import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Copy,
  RefreshCw,
  Undo2,
  CheckCircle2,
  Printer,
  Download,
  RotateCw,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getFNEInvoice,
  refundFNEInvoice,
  submitFactureToFNE,
  STATUT_FNE_LABEL,
  STATUT_FNE_COLOR,
  type FNEStatus,
} from "@/lib/fne-api";
import { formatFCFA } from "@/lib/format";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { friendlyError } from "@/lib/friendly-error";

export const Route = createFileRoute("/_authenticated/fne-detail/$factureId")({
  component: FNEDetail,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function copy(v: string) {
  navigator.clipboard.writeText(v);
  toast.success("Copié");
}

function FNEDetail() {
  const { factureId } = Route.useParams();
  const qc = useQueryClient();
  const { data: f, isLoading } = useQuery({
    queryKey: ["fne-invoice", factureId],
    queryFn: () => getFNEInvoice(factureId),
  });
  const refund = useMutation({
    mutationFn: () => refundFNEInvoice(factureId, [{ id: factureId, quantity: 1 }]),
    onSuccess: () => {
      toast.success("Avoir émis");
      qc.invalidateQueries({ queryKey: ["fne-invoice", factureId] });
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });
  const retry = useMutation({
    mutationFn: async () => {
      if (!f || !f.facture_id)
        throw new Error("Facture commerciale liée introuvable — réessai impossible");
      if (!f.reference) throw new Error("Référence FNE absente — réessai impossible");
      return submitFactureToFNE({
        facture_id: f.facture_id,
        reference: f.reference,
        client_nom: f.client_nom,
        montant_total: Number(f.montant ?? 0),
        date_facture: f.date_emission ?? new Date().toISOString().slice(0, 10),
      });
    },
    onSuccess: () => {
      toast.success("Nouvelle tentative envoyée");
      qc.invalidateQueries({ queryKey: ["fne-invoice", factureId] });
      qc.invalidateQueries({ queryKey: ["fne-list"] });
    },
    onError: (e: Error) =>
      toast.error("Échec de la nouvelle tentative", { description: friendlyError(e) }),
  });

  const downloadJSON = () => {
    if (!f) return;
    const blob = new Blob([JSON.stringify(f, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fne_${f.reference}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading || !f) return <Skeleton className="h-96 w-full" />;
  const s = (f.statut as FNEStatus) ?? "pending";
  const items = Array.isArray(f.items)
    ? (f.items as Array<{
        reference?: string;
        description?: string;
        quantity?: number;
        amount?: number;
        discount?: number;
        taxes?: string[];
      }>)
    : [];
  const subtotal = items.reduce(
    (sum, it) => sum + Number(it.quantity ?? 0) * Number(it.amount ?? 0),
    0,
  );
  const tva = subtotal * 0.18;
  const canRetry = s === "rejected" || s === "error";

  return (
    <div className="space-y-4 print:space-y-2">
      <div className="flex items-center justify-between print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link to="/fne">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Retour
          </Link>
        </Button>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => qc.invalidateQueries({ queryKey: ["fne-invoice", factureId] })}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Rafraîchir
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" />
            Imprimer / PDF
          </Button>
          <Button variant="outline" size="sm" onClick={downloadJSON}>
            <Download className="h-4 w-4 mr-1" />
            JSON
          </Button>
          {canRetry && (
            <Button
              variant="outline"
              size="sm"
              disabled={retry.isPending}
              onClick={() => retry.mutate()}
            >
              <RotateCw className="h-4 w-4 mr-1" />
              {retry.isPending ? "Envoi…" : "Réessayer"}
            </Button>
          )}
          {s === "accepted" && (
            <Button
              variant="destructive"
              size="sm"
              disabled={refund.isPending}
              onClick={() => {
                if (confirm("Émettre un avoir pour cette facture certifiée ?")) refund.mutate();
              }}
            >
              <Undo2 className="h-4 w-4 mr-1" />
              Émettre un avoir
            </Button>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{f.reference}</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge style={{ backgroundColor: STATUT_FNE_COLOR[s] ?? "#999", color: "#fff" }}>
              {STATUT_FNE_LABEL[s] ?? s}
            </Badge>
            <dl className="grid grid-cols-3 gap-2 text-sm mt-4">
              <dt className="text-muted-foreground">Client</dt>
              <dd className="col-span-2">{f.client_nom}</dd>
              <dt className="text-muted-foreground">Montant</dt>
              <dd className="col-span-2">{formatFCFA(Number(f.montant ?? 0))}</dd>
              <dt className="text-muted-foreground">Template</dt>
              <dd className="col-span-2">{f.template ?? "—"}</dd>
              <dt className="text-muted-foreground">Mode paiement</dt>
              <dd className="col-span-2">{f.payment_method ?? "—"}</dd>
              <dt className="text-muted-foreground">Code DGI</dt>
              <dd className="col-span-2 font-mono text-xs flex items-center gap-1">
                {f.code_dgi ?? "—"}{" "}
                {f.code_dgi && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-5 w-5"
                    onClick={() => copy(f.code_dgi!)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                )}
              </dd>
              <dt className="text-muted-foreground">Token</dt>
              <dd className="col-span-2 font-mono text-xs truncate flex items-center gap-1">
                {f.token ?? "—"}{" "}
                {f.token && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-5 w-5"
                    onClick={() => copy(f.token!)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                )}
              </dd>
              <dt className="text-muted-foreground">Source</dt>
              <dd className="col-span-2">
                {f.source === "dgi_api" ? (
                  <Badge className="gap-1" style={{ backgroundColor: "#10B981", color: "#fff" }}>
                    <CheckCircle2 className="h-3 w-3" />
                    API DGI
                  </Badge>
                ) : (
                  <Badge variant="secondary">Sandbox</Badge>
                )}
              </dd>
              <dt className="text-muted-foreground">Créée le</dt>
              <dd className="col-span-2">
                {f.created_at ? new Date(f.created_at).toLocaleString("fr-FR") : "—"}
              </dd>
              <dt className="text-muted-foreground">Soumise le</dt>
              <dd className="col-span-2">
                {f.submitted_at ? new Date(f.submitted_at).toLocaleString("fr-FR") : "—"}
              </dd>
              <dt className="text-muted-foreground">Certifiée le</dt>
              <dd className="col-span-2">
                {f.validated_at ? new Date(f.validated_at).toLocaleString("fr-FR") : "—"}
              </dd>
              {f.error_message && (
                <>
                  <dt className="text-destructive">Erreur</dt>
                  <dd className="col-span-2 text-destructive">{f.error_message}</dd>
                </>
              )}
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">QR Code DGI</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center min-h-[260px]">
            {f.qr_code ? (
              <img
                src={f.qr_code}
                alt="QR DGI"
                className="w-56 h-56"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="w-56 h-56 border-2 border-dashed rounded flex items-center justify-center text-muted-foreground text-sm text-center px-4">
                QR généré après certification
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Articles facturés</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun détail d'article enregistré.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Référence</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qté</TableHead>
                  <TableHead className="text-right">PU</TableHead>
                  <TableHead>Taxes</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{it.reference ?? "—"}</TableCell>
                    <TableCell>{it.description ?? "—"}</TableCell>
                    <TableCell className="text-right">{it.quantity ?? 0}</TableCell>
                    <TableCell className="text-right">
                      {formatFCFA(Number(it.amount ?? 0))}
                    </TableCell>
                    <TableCell className="text-xs">{(it.taxes ?? []).join(", ") || "—"}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatFCFA(Number(it.quantity ?? 0) * Number(it.amount ?? 0))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="mt-3 flex justify-end">
            <dl className="grid grid-cols-[auto_auto] gap-x-6 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Total HT</dt>
              <dd className="text-right">{formatFCFA(subtotal)}</dd>
              <dt className="text-muted-foreground">TVA (18 %)</dt>
              <dd className="text-right">{formatFCFA(tva)}</dd>
              <dt className="font-semibold">Total TTC</dt>
              <dd className="text-right font-semibold">{formatFCFA(Number(f.montant ?? 0))}</dd>
            </dl>
          </div>
        </CardContent>
      </Card>

      {f.response_payload && (
        <Card className="print:hidden">
          <CardHeader>
            <CardTitle className="text-base">Réponse DGI (JSON)</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-72">
              {JSON.stringify(f.response_payload, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      <div className="print:hidden">
        <Button asChild variant="link" size="sm">
          <Link to="/fne" search={{ tab: "logs" }}>
            Voir les logs FNE
          </Link>
        </Button>
      </div>
    </div>
  );
}
