import { formatDate } from "@/lib/format";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Ban, Gift, Loader2, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResponsiveTable } from "@/components/layout/ResponsiveTable";
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

import { STATUT_SPECIMEN_LABEL, annulerSpecimen, getSpecimen } from "@/lib/specimens-api";
import { invalidateSpecimen } from "@/lib/cache-invalidation";
import { Can } from "@/components/rbac/Can";
import { downloadBlob, fileNameFor, generateBonRemiseSpecimensPDF } from "@/lib/pdf/fabsTemplates";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { friendlyError } from "@/lib/friendly-error";

export const Route = createFileRoute("/_authenticated/specimens/$specimenId")({
  component: SpecimenDetailPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function SpecimenDetailPage() {
  const { specimenId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [printing, setPrinting] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["specimen", specimenId],
    queryFn: () => getSpecimen(specimenId),
  });

  const cancelMutation = useMutation({
    mutationFn: () => annulerSpecimen(specimenId),
    onSuccess: () => {
      toast.success("Spécimen annulé — stock réinjecté");
      invalidateSpecimen(qc, specimenId);
      setConfirmCancel(false);
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  const handlePrint = async () => {
    if (!data) return;
    setPrinting(true);
    try {
      const blob = await generateBonRemiseSpecimensPDF({
        reference: data.numero,
        date: data.date_envoi,
        clientNom: data.etablissement,
        clientTel: data.telephone,
        representant: data.representant_nom,
        lignes: data.lignes.map((l) => ({
          reference: l.reference_produit ?? "",
          codeArticle: l.reference_produit ?? "",
          niveau: l.designation,
          qte: l.quantite,
        })),
      });
      downloadBlob(blob, fileNameFor(data.numero, data.etablissement));
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setPrinting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Chargement…
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="p-6">
        <p className="text-destructive">Spécimen introuvable.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/specimens">Retour</Link>
        </Button>
      </div>
    );
  }

  const st = STATUT_SPECIMEN_LABEL[data.statut];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button aria-label="Retour" variant="ghost" size="icon" onClick={() => navigate({ to: "/specimens" })}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Gift className="h-6 w-6 text-primary" />
          <div>
            <h1 className="ds-page-title">{data.numero}</h1>
            <p className="text-sm text-muted-foreground">
              {formatDate(data.date_envoi)} — {data.etablissement}
            </p>
          </div>
          <Badge style={{ backgroundColor: st?.color, color: "white" }}>
            {st?.label ?? data.statut}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint} disabled={printing}>
            {printing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Printer className="h-4 w-4 mr-2" />
            )}
            Imprimer
          </Button>
          {data.statut === "enregistre" && (
            <Can permission="specimens.annuler">
              <Button variant="destructive" onClick={() => setConfirmCancel(true)}>
                <Ban className="h-4 w-4 mr-2" /> Annuler le spécimen
              </Button>
            </Can>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-md border bg-card p-5 space-y-2">
          <h2 className="font-semibold">Informations générales</h2>
          <Info label="Numéro" value={data.numero} />
          <Info
            label="Date d'envoi"
            value={formatDate(data.date_envoi)}
          />
          <Info label="Motif" value={data.motif} />
          <Info label="Donneur des spécimens" value={data.donneur_nom} />
          <Info label="Gestionnaire" value={data.gestionnaire_nom} />
          <Info label="Observations" value={data.observations} />
        </section>
        <section className="rounded-md border bg-card p-5 space-y-2">
          <h2 className="font-semibold">Bénéficiaire</h2>
          <Info label="Établissement" value={data.etablissement} />
          <Info label="Représentant" value={data.representant_nom} />
          <Info label="Téléphone" value={data.telephone} />
          <Info label="Ville" value={data.ville} />
          <Info label="Adresse" value={data.adresse} />
        </section>
      </div>

      <section className="rounded-md border bg-card">
        <div className="p-4 flex items-center justify-between">
          <h2 className="font-semibold">
            Produits remis ({data.nb_produits} produits — {data.total_quantite} articles)
          </h2>
        </div>
        <ResponsiveTable stickyFirstCol>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Référence</TableHead>
                <TableHead>Désignation</TableHead>
                <TableHead className="text-right">Quantité</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.lignes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                    Aucune ligne
                  </TableCell>
                </TableRow>
              ) : (
                data.lignes.map((l) => (
                  <TableRow key={l.ligne_id}>
                    <TableCell className="font-mono text-xs">
                      {l.reference_produit ?? "—"}
                    </TableCell>
                    <TableCell>{l.designation}</TableCell>
                    <TableCell className="text-right">{l.quantite}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ResponsiveTable>
      </section>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler le spécimen {data.numero} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le stock sera réinjecté ({data.total_quantite} article(s)).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Retour</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? "Annulation…" : "Confirmer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-sm">
      <div className="text-muted-foreground">{label}</div>
      <div className="col-span-2 font-medium">{value || "—"}</div>
    </div>
  );
}
