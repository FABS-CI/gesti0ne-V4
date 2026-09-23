import { createFileRoute, Link } from "@tanstack/react-router";
import { friendlyError } from '@/lib/friendly-error';
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Calendar,
  CreditCard,
  FileDown,
  Loader2,
  Receipt,
  ShieldCheck,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { submitFactureToFNE, getFneFactureForFacture, getBalanceSticker } from "@/lib/fne-api";
import { invalidateFne } from "@/lib/cache-invalidation";

import {
  getFacture,
  getFacturePaiements,
  getFactureLignes,
  getFactureRetours,
  computeRetourResume,
  RETOUR_STATUS_META,
  STATUT_FACTURE_LABEL,
} from "@/lib/factures-api";
import { formatFCFA } from "@/lib/format";
import { fileNameFor } from "@/lib/pdf/fabsTemplates";
import { generateUnifiedCommercialPDF } from "@/lib/pdf/unified-generator";
import {
  loadFactureDocLignes,
  loadClientInfoForFacture,
  loadFactureTotals,
} from "@/lib/pdf/enrich-lignes";
import { usePdfDownload } from "@/hooks/use-pdf-download";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatFCFA as fmt } from "@/lib/format";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { CertificationCard } from "@/components/certification/CertificationCard";

export const Route = createFileRoute("/_authenticated/factures/$factureId")({
  component: FactureDetailPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function frDate(d: string | null | undefined) {
  return d ? new Date(d).toLocaleDateString("fr-FR") : "—";
}

function FactureDetailPage() {
  const { factureId } = Route.useParams();
  const pdf = usePdfDownload();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { data: facture, isLoading } = useQuery({
    queryKey: ["facture", factureId],
    queryFn: () => getFacture(factureId),
  });
  const { data: paiements = [] } = useQuery({
    queryKey: ["facture-paiements", factureId],
    queryFn: () => getFacturePaiements(factureId),
  });
  const { data: lignes = [] } = useQuery({
    queryKey: ["facture-lignes", factureId],
    queryFn: () => getFactureLignes(factureId),
  });
  const { data: fne } = useQuery({
    queryKey: ["fne-facture", factureId],
    queryFn: () => getFneFactureForFacture(factureId),
  });
  const { data: sticker } = useQuery({
    queryKey: ["fne-sticker"],
    queryFn: getBalanceSticker,
  });
  const { data: retours = [] } = useQuery({
    queryKey: ["facture-retours", factureId],
    queryFn: () => getFactureRetours(factureId),
  });
  const qc = useQueryClient();
  const submitFne = useMutation({
    mutationFn: () =>
      submitFactureToFNE({
        facture_id: factureId,
        reference: facture!.reference,
        client_nom: facture!.client_nom,
        montant_total: facture!.montant_total,
        date_facture: facture!.date_facture,
      }),
    onSuccess: (d) => {
      toast.success(`Facture certifiée avec succès — code ${d.code_dgi}`);
      setConfirmOpen(false);
      invalidateFne(qc, factureId);
    },
    onError: (e: Error) =>
      toast.error("La certification a été refusée par la DGI", { description: friendlyError(e) }),
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!facture)
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Facture introuvable.</p>
        <Button asChild variant="outline">
          <Link to="/factures">Retour</Link>
        </Button>
      </div>
    );

  const statut = STATUT_FACTURE_LABEL[facture.statut];
  const reste = Math.max(0, (facture.montant_total ?? 0) - (facture.montant_paye ?? 0));
  const pct = facture.montant_total
    ? Math.round((facture.montant_paye / facture.montant_total) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link to="/factures">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold">Facture {facture.reference}</h1>
            <p className="text-sm text-muted-foreground">
              {facture.client_nom ?? "Client non renseigné"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(() => {
            const st = pdf.getState(facture.facture_id);
            const docData = {
              reference: facture.reference,
              id: facture.facture_id,
              facture_id: facture.facture_id,
              date: facture.date_facture,
              clientNom: facture.client_nom,
              totalVente: Number(facture.montant_total),
              montantHT: Number(facture.montant_total),
              paye: Number(facture.montant_paye),
              soldeDu: Math.max(0, Number(facture.montant_total) - Number(facture.montant_paye)),
              statut: statut ? { label: statut.label, color: statut.color } : null,
            };
            return (
              <Button
                size="sm"
                variant="outline"
                disabled={st.loading}
                onClick={() =>
                  pdf.download(
                    facture.facture_id,
                    async () => {
                      const [lignes, clientInfo, totals] = await Promise.all([
                        loadFactureDocLignes(facture.facture_id),
                        loadClientInfoForFacture(facture.facture_id),
                        loadFactureTotals(facture.facture_id),
                      ]);
                      return generateUnifiedCommercialPDF("Facture", { ...docData, ...clientInfo, ...totals, lignes });
                    },
                    fileNameFor(facture.reference, facture.client_nom),
                    { type: "FC", data: { ...docData, date: docData.date } },
                  )
                }
              >
                {st.loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="mr-2 h-4 w-4" />
                )}
                {st.loading ? "Génération…" : "Télécharger PDF"}
              </Button>
            );
          })()}
          {fne ? (
            <Badge variant="outline" className="gap-1">
              <ShieldCheck className="h-3 w-3" /> FNE {fne.code_dgi}
            </Badge>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmOpen(true)}
              disabled={submitFne.isPending}
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              {submitFne.isPending ? "Normalisation…" : "Normaliser la facture"}
            </Button>
          )}
          {statut && (
            <Badge style={{ backgroundColor: statut.color }} className="text-white">
              {statut.label}
            </Badge>
          )}
        </div>
      </div>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(o) => !submitFne.isPending && setConfirmOpen(o)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmation de la normalisation FNE</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Vous êtes sur le point d'envoyer cette facture à la DGI pour normalisation. Cette
                  opération consommera un sticker fiscal et pourra être irréversible selon les
                  règles de la DGI.
                </p>
                <div className="rounded border bg-muted/40 p-3 text-sm grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-muted-foreground">N° facture :</span>{" "}
                    <span className="font-mono">{facture.reference}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Client :</span>{" "}
                    {facture.client_nom ?? "—"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Date :</span>{" "}
                    {frDate(facture.date_facture)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Montant TTC :</span>{" "}
                    <strong>{fmt(facture.montant_total)}</strong>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Stickers restants :</span>{" "}
                    {sticker?.mode === "production" ? (
                      <strong>{sticker.balance}</strong>
                    ) : (
                      <em>mode sandbox</em>
                    )}
                  </div>
                </div>
                <p className="font-medium">Confirmez-vous la normalisation de cette facture ?</p>
                {submitFne.isPending && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Normalisation de la facture en
                    cours…
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitFne.isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (!submitFne.isPending) submitFne.mutate();
              }}
              disabled={submitFne.isPending}
            >
              {submitFne.isPending ? "Envoi en cours…" : "Confirmer la normalisation"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" /> Client
            </CardTitle>
          </CardHeader>
          <CardContent className="font-medium">{facture.client_nom ?? "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" /> Échéance
            </CardTitle>
          </CardHeader>
          <CardContent className="font-medium">{frDate(facture.date_echeance)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <Receipt className="h-4 w-4" /> Total
            </CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-bold text-primary">
            {formatFCFA(facture.montant_total)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <CreditCard className="h-4 w-4" /> Reste à payer
            </CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-bold">{formatFCFA(reste)}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Règlement ({pct}%)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Progress value={pct} />
          <p className="text-sm text-muted-foreground">
            {formatFCFA(facture.montant_paye)} payé sur {formatFCFA(facture.montant_total)}
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Détail des articles</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Désignation</TableHead>
                <TableHead className="text-right">Remise (%)</TableHead>
                <TableHead className="text-right">Qté</TableHead>
                <TableHead className="text-right">P.U.</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lignes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Chargement des lignes...
                  </TableCell>
                </TableRow>
              ) : (
                lignes.map((l: any) => (
                  <TableRow key={l.ligne_id}>
                    <TableCell>{l.designation}</TableCell>
                    <TableCell className="text-right text-destructive">
                      {l.remise_pct ? `${l.remise_pct} %` : "—"}
                    </TableCell>
                    <TableCell className="text-right">{l.quantite}</TableCell>
                    <TableCell className="text-right">{formatFCFA(l.prix_unitaire)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatFCFA(l.total_ligne)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {(() => {
            const typeTransport = (facture as any).type_frais_transport as
              | "livraison"
              | "expedition"
              | null;
            const fraisTransport = Number((facture as any).montant_frais_transport ?? 0);
            const total = Number(facture.montant_total ?? 0);
            const sousTotal = total - (typeTransport ? fraisTransport : 0);
            return (
              <div className="mt-4 space-y-1 border-t pt-3 text-sm sm:ml-auto sm:max-w-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sous-total produits</span>
                  <span>{formatFCFA(sousTotal)}</span>
                </div>
                {typeTransport && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {typeTransport === "livraison"
                        ? "Frais de livraison"
                        : "Frais d'expédition"}
                    </span>
                    <span>{formatFCFA(fraisTransport)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-1 font-bold">
                  <span>TOTAL</span>
                  <span>{formatFCFA(total)}</span>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Paiements</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Référence</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead className="text-right">Montant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paiements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Aucun paiement
                  </TableCell>
                </TableRow>
              ) : (
                paiements.map((p) => (
                  <TableRow key={p.paiement_id}>
                    <TableCell>{p.reference}</TableCell>
                    <TableCell>{frDate(p.date_paiement)}</TableCell>
                    <TableCell>{p.mode_paiement}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatFCFA(p.montant)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {(() => {
        const resume = computeRetourResume(Number(facture.montant_total), retours);
        const meta = RETOUR_STATUS_META[resume.status];
        const brut = Number(facture.montant_total) + resume.totalMontantRetour;
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span>Retours enregistrés</span>
                <Badge
                  variant="outline"
                  style={{ color: meta.color, borderColor: meta.color }}
                >
                  {meta.label}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {retours.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucun retour n'a été enregistré sur cette facture.
                </p>
              ) : (
                <>
                  <div className="grid gap-2 rounded-md border bg-muted/30 p-3 text-sm sm:grid-cols-3">
                    <div>
                      <div className="text-muted-foreground">Montant initial</div>
                      <div className="font-semibold">{formatFCFA(brut)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Total des retours</div>
                      <div className="font-semibold text-orange-600">
                        − {formatFCFA(resume.totalMontantRetour)}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Montant net</div>
                      <div className="font-semibold text-primary">
                        {formatFCFA(Number(facture.montant_total))}
                      </div>
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Référence</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Quantité</TableHead>
                        <TableHead className="text-right">Montant</TableHead>
                        <TableHead>Motif</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {retours.map((r) => (
                        <TableRow key={r.retour_id}>
                          <TableCell className="font-mono text-xs">{r.reference}</TableCell>
                          <TableCell>{frDate(r.date_retour)}</TableCell>
                          <TableCell className="text-right">{r.quantite}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatFCFA(r.montant)}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {r.motif ?? "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </CardContent>
          </Card>
        );
      })()}

      <CertificationCard reference={facture.reference} />
    </div>
  );
}
