import { PageHeader } from "@/components/common/PageHeader";
import { formatDocumentReference } from "@/lib/document-reference";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Ban, Calendar, FileDown, FileText, Loader2, Package, Pencil, Receipt, User } from "lucide-react";
import { ProductCoverThumb } from "@/components/produits/ProductCoverThumb";
import { generateUnifiedCommercialPDF } from "@/lib/pdf/unified-generator";
import { fileNameFor } from "@/lib/pdf/fabsTemplates";
import {
  loadCommandeDocLignes,
  loadClientInfoForCommande,
  loadCommandeTotals,
} from "@/lib/pdf/enrich-lignes";
import { usePdfDownload } from "@/hooks/use-pdf-download";
import { useState } from "react";
import { toast } from "sonner";

import {
  demanderAnnulationCommande,
  getCommande,
  getCommandeLignes,
  STATUT_LABEL,
} from "@/lib/commandes-api";
import { friendlyError } from "@/lib/friendly-error";
import { formatFCFA } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePermissions } from "@/hooks/use-permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/commandes/$commandeId/")({
  component: CommandeDetailPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});


function frDate(d: string | null | undefined) {
  return d ? new Date(d).toLocaleDateString("fr-FR") : "—";
}

function CommandeDetailPage() {
  const { commandeId } = Route.useParams();
  const { has: hasPermission, isSuperAdmin } = usePermissions();
  const canModifier = hasPermission("commandes.modifier");
  const canDemanderAnnulation = hasPermission("commandes.supprimer") || isSuperAdmin;
  const pdf = usePdfDownload();
  const queryClient = useQueryClient();
  const [annulOpen, setAnnulOpen] = useState(false);
  const [annulMotif, setAnnulMotif] = useState("");
  const { data: commande, isLoading } = useQuery({
    queryKey: ["commande", commandeId],
    queryFn: () => getCommande(commandeId),
  });
  const { data: lignes = [] } = useQuery({
    queryKey: ["commande-lignes", commandeId],
    queryFn: () => getCommandeLignes(commandeId),
  });
  const annulMut = useMutation({
    mutationFn: () => demanderAnnulationCommande(commandeId, annulMotif.trim()),
    onSuccess: () => {
      toast.success("Demande d'annulation envoyée pour approbation");
      queryClient.invalidateQueries({ queryKey: ["commande", commandeId] });
      queryClient.invalidateQueries({ queryKey: ["commandes"] });
      queryClient.invalidateQueries({ queryKey: ["approbations"] });
      setAnnulOpen(false);
      setAnnulMotif("");
    },
    onError: (e) => toast.error(friendlyError(e, "Impossible de demander l'annulation")),
  });


  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!commande)
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Commande introuvable.</p>
        <Button asChild variant="outline">
          <Link to="/commandes">Retour</Link>
        </Button>
      </div>
    );

  const statut = STATUT_LABEL[commande.statut];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          className="mb-0 border-0 pb-0"
          backTo="/commandes"
          title={`Commande ${formatDocumentReference(commande.reference)}`}
          description={commande.client_nom ?? "Client non renseigné"}
        />
        {statut && (
          <Badge style={{ backgroundColor: statut.color }} className="text-white">
            {statut.label}
          </Badge>
        )}
        <div className="flex items-center gap-2">
          {(() => {
            const st = pdf.getState(commandeId);
            return (
              <Button
                size="sm"
                variant="outline"
                disabled={st.loading}
                onClick={() =>
                  pdf.download(
                    commandeId,
                    async () => {
                      const [lignes, clientInfo, totals] = await Promise.all([
                        loadCommandeDocLignes(commandeId),
                        loadClientInfoForCommande(commandeId),
                        loadCommandeTotals(commandeId),
                      ]);
                      return generateUnifiedCommercialPDF("Commande", {
                        id: commandeId,
                        commande_id: commandeId,
                        reference: commande.reference,
                        date: commande.date_commande,
                        clientNom: commande.client_nom,
                        totalVente: Number(commande.montant_total),
                        montantHT: Number(commande.montant_total),
                        lignes,
                        ...clientInfo,
                        ...totals,
                      });
                    },
                    fileNameFor(commande.reference, commande.client_nom),
                    {
                      type: "BC",
                      data: {
                        ...commande,
                        clientNom: commande.client_nom,
                        date: commande.date_commande,
                        statut: STATUT_LABEL[commande.statut]
                          ? {
                              label: STATUT_LABEL[commande.statut].label,
                              color: STATUT_LABEL[commande.statut].color,
                            }
                          : null,
                      } as any,
                    }
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
          {canModifier &&
            (isSuperAdmin ||
              commande.statut === "brouillon" ||
              commande.statut === "en_attente_validation") && (
              <Button asChild variant="default" size="sm">
                <Link to="/commandes/$commandeId/modifier" params={{ commandeId }}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Modifier la commande
                </Link>
              </Button>
            )}
        </div>
        {canDemanderAnnulation &&
          commande.statut !== "annulee" &&
          commande.statut !== "annulation_en_attente" && (
            <Button variant="outline" size="sm" onClick={() => setAnnulOpen(true)}>
              <Ban className="mr-2 h-4 w-4 text-destructive" />
              Demander l'annulation
            </Button>
          )}
        {commande.statut === "annulation_en_attente" && (
          <Badge variant="outline" className="border-warning text-warning">
            En attente d'approbation
          </Badge>
        )}
      </div>


      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" /> Client
            </CardTitle>
          </CardHeader>
          <CardContent className="font-medium">{commande.client_nom ?? "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" /> Date
            </CardTitle>
          </CardHeader>
          <CardContent className="font-medium">{frDate(commande.date_commande)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" /> Remise
            </CardTitle>
          </CardHeader>
          <CardContent className="font-medium">
            {(() => {
              const brut = Number(commande.total_ht_brut ?? 0);
              const remLignes = Number(commande.total_remises_lignes ?? 0);
              const remGlobM = Number(commande.remise_globale_montant ?? 0);
              const remGlobPct = Number(commande.remise_globale_pct ?? 0);
              const totalRem = remLignes + remGlobM;
              const effectivePct = brut > 0 ? Math.round((totalRem / brut) * 1000) / 10 : 0;
              return (
                <>
                  {effectivePct} %
                  {totalRem > 0 && (
                    <span className="ml-2 text-sm text-muted-foreground">
                      ({formatFCFA(totalRem)})
                    </span>
                  )}
                  {remLignes > 0 && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Remises lignes : {formatFCFA(remLignes)}
                    </div>
                  )}
                  {remGlobM > 0 && (
                    <div className="text-xs text-muted-foreground">
                      Remise globale : {remGlobPct}% ({formatFCFA(remGlobM)})
                    </div>
                  )}
                </>
              );
            })()}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <Receipt className="h-4 w-4" /> Total
            </CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-bold text-primary">
            {formatFCFA(commande.montant_total)}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lignes de commande</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Désignation</TableHead>
                <TableHead className="text-right">P.U.</TableHead>
                <TableHead className="text-right">Remise (%)</TableHead>
                <TableHead className="text-right">Qté</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lignes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Aucune ligne
                  </TableCell>
                </TableRow>
              ) : (
                lignes.map((l) => (
                  <TableRow key={l.ligne_id} className="align-middle">
                    <TableCell className="w-[60px] pr-0">
                      <ProductCoverThumb
                        produit={{
                          titre: l.designation,
                          cover_path: (l as any).produits?.cover_path || (l as any).cover_path,
                          cover_thumb_path: (l as any).produits?.cover_thumb_path || (l as any).cover_thumb_path,
                        }}
                        size="xs"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{l.designation}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        {l.reference_produit || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{formatFCFA(l.prix_unitaire)}</TableCell>
                    <TableCell className="text-right text-destructive">
                      {l.remise_pct ? `${l.remise_pct} %` : "—"}
                    </TableCell>
                    <TableCell className="text-right">{l.quantite}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatFCFA(l.total_ligne)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {commande.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">
            {commande.notes}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={annulOpen} onOpenChange={setAnnulOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Demander l'annulation de la commande ?</AlertDialogTitle>
            <AlertDialogDescription>
              La commande passera en statut « Annulation en attente ». Un comptable devra approuver
              ou rejeter la demande depuis le centre d'approbations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1 py-2">
            <Label htmlFor="motif-annul-cmd">
              Motif <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="motif-annul-cmd"
              value={annulMotif}
              onChange={(e) => setAnnulMotif(e.target.value)}
              placeholder="Justification (erreur, demande client, doublon…)"
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Retour</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (!annulMotif.trim()) {
                  toast.error("Motif obligatoire");
                  return;
                }
                annulMut.mutate();
              }}
              disabled={annulMut.isPending || !annulMotif.trim()}
            >
              Envoyer la demande
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}