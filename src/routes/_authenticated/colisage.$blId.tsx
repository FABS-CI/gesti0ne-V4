import { formatDocumentReference } from "@/lib/document-reference";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Package, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResponsiveTable } from "@/components/layout/ResponsiveTable";
import { STATUT_BL_LABEL, isColisageEnAttente } from "@/lib/colisage-api";
import { buildEtiquettesPayload, keyForLigne } from "@/lib/colisage-helpers";
import { triggerAutoPrintEtiquettes } from "@/lib/colisage-print-utils";
import { useColisageDetail } from "@/hooks/use-colisage-detail";
import { usePermissions } from "@/hooks/use-permissions";
import { ColisageActionButtons } from "@/components/colisage/ColisageActionButtons";
import { ColisageForm } from "@/components/colisage/ColisageForm";
import { EtiquettesSection } from "@/components/colisage/EtiquettesSection";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/colisage/$blId")({
  component: ColisageDetailPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function ColisageDetailPage() {
  const { blId } = Route.useParams();
  const navigate = useNavigate();

  const {
    bl,
    isLoading,
    clientInfo,
    colisExistants,
    responsablesList,
    zonesDirectes,
    annulerMut,
    supprMut,
    deverMut,
  } = useColisageDetail(blId);

  const { isSuperAdmin, has } = usePermissions();
  const canDeverrouiller = has("colisage.deverrouiller");

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!bl)
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Bon de livraison introuvable.</p>
        <Button asChild variant="outline">
          <Link to="/colisage">Retour</Link>
        </Button>
      </div>
    );

  const st = STATUT_BL_LABEL[bl.statut];
  const hasColis = (colisExistants ?? []).length > 0;
  const modifiable = isColisageEnAttente(bl.statut) || isSuperAdmin;
  const annulable = isColisageEnAttente(bl.statut) || isSuperAdmin;
  const suppressible = isColisageEnAttente(bl.statut) || bl.statut === "annule" || isSuperAdmin;
  const locked = !isColisageEnAttente(bl.statut) && !isSuperAdmin;

  const etiquettes = hasColis ? buildEtiquettesPayload(colisExistants!, bl) : [];

  return (
    <div className="space-y-6 print:space-y-2">
      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/colisage" })}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="rounded-lg bg-primary/10 p-2">
            <Package className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="ds-page-title">Colisage — {formatDocumentReference(bl.reference)}</h1>
            <p className="text-sm text-muted-foreground">{bl.client_nom ?? "—"}</p>
          </div>
        </div>
        {st && (
          <Badge style={{ backgroundColor: st.color }} className="text-white">
            {st.label}
          </Badge>
        )}
      </div>

      <ColisageActionButtons
        blReference={bl.reference}
        isSuperAdmin={isSuperAdmin}
        canDeverrouiller={canDeverrouiller}
        annulable={annulable}
        suppressible={suppressible}
        statut={bl.statut}
        annulerMut={annulerMut}
        supprMut={supprMut}
        deverMut={deverMut}
      />

      {locked && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200 print:hidden">
          Ce colisage ne peut plus être modifié car il est déjà en cours de traitement par le
          service logistique.
        </div>
      )}

      {bl.statut === "colisage_termine" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-900 dark:text-emerald-200 print:hidden">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            <span>
              <strong>Colisage terminé</strong> — prochaine étape : créer une tournée et la
              valider pour déclencher le suivi de livraison.
            </span>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/tournees/nouvelle">
              <Truck className="mr-2 h-4 w-4" /> Créer une tournée
            </Link>
          </Button>
        </div>
      )}

      {/* Cartes infos */}
      <div className="grid gap-4 md:grid-cols-3 print:hidden">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Documents</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <div>
              <span className="font-semibold">Commande :</span> {bl.commande_reference ?? "—"}
            </div>
            <div>
              <span className="font-semibold">Facture :</span> {bl.facture_reference ?? "—"}
            </div>
            <div>
              <span className="font-semibold">BL :</span> {formatDocumentReference(bl.reference)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Client</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <div className="font-semibold">{bl.client_nom ?? "—"}</div>
            <div>
              {bl.representant_nom ?? ""}
              {bl.telephone ? ` · ${bl.telephone}` : ""}
            </div>
            <div>{bl.ville ?? ""}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Récap</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <div>
              <span className="font-semibold">Articles :</span> {bl.nb_articles}
            </div>
            <div>
              <span className="font-semibold">Quantité totale :</span> {bl.total_quantite}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table produits */}
      <Card className="print:hidden">
        <CardHeader>
          <CardTitle className="text-sm">Produits à coliser</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ResponsiveTable stickyFirstCol>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Référence</TableHead>
                  <TableHead>Désignation</TableHead>
                  <TableHead className="text-right">Qté</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bl.lignes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                      Aucune ligne
                    </TableCell>
                  </TableRow>
                ) : (
                  bl.lignes.map((l, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">
                        {l.reference_produit ?? "—"}
                      </TableCell>
                      <TableCell>{l.designation ?? "—"}</TableCell>
                      <TableCell className="text-right">{l.quantite}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ResponsiveTable>
        </CardContent>
      </Card>

      {/* Rendu permanent du formulaire pour consultation ou modification */}
      <ColisageForm
        blId={blId}
        bl={bl}
        clientInfo={clientInfo!}
        zonesDirectes={zonesDirectes}
        responsablesList={responsablesList}
        modifiable={modifiable}
        hasColis={hasColis}
        colisExistants={colisExistants}
        onSuccess={(createdColis) => {
          // Déclenchement automatique de l'affichage/impression des étiquettes
          triggerAutoPrintEtiquettes(createdColis, bl);
        }}
      />

      {etiquettes.length > 0 && (
        <div id="section-etiquettes-cartons">
          <EtiquettesSection etiquettes={etiquettes} blReference={bl.reference} />
        </div>
      )}
    </div>
  );
}
