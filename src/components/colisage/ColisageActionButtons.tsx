import { useState } from "react";
import type { UseMutationResult } from "@tanstack/react-query";
import type { SupprimerColisageSummary } from "@/lib/colisage-api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { Can } from "@/components/rbac/Can";

interface Props {
  blReference: string;
  isSuperAdmin: boolean;
  canDeverrouiller: boolean;
  annulable: boolean;
  suppressible: boolean;
  statut: string;
  annulerMut: UseMutationResult<void, Error, string | null>;
  supprMut: UseMutationResult<SupprimerColisageSummary | null, Error, string | null>;
  deverMut: UseMutationResult<void, Error, string>;
}

export function ColisageActionButtons({
  blReference,
  isSuperAdmin,
  canDeverrouiller,
  annulable,
  suppressible,
  statut,
  annulerMut,
  supprMut,
  deverMut,
}: Props) {
  const [motifAnnul, setMotifAnnul] = useState("");
  const [motifDever, setMotifDever] = useState("");
  const [openAnnul, setOpenAnnul] = useState(false);
  const [openSuppr, setOpenSuppr] = useState(false);
  const [openDever, setOpenDever] = useState(false);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
      {annulable ? (
        <Can permission="colisage.annuler">
          <AlertDialog open={openAnnul} onOpenChange={setOpenAnnul}>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                Annuler le colisage
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Annuler le colisage {blReference} ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action passe le colisage au statut « Annulé » et supprime les cartons
                  générés.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2">
                <Label>Motif (optionnel)</Label>
                <Textarea value={motifAnnul} onChange={(e) => setMotifAnnul(e.target.value)} />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Retour</AlertDialogCancel>
                <Button
                  type="button"
                  disabled={annulerMut.isPending}
                  onClick={() => {
                    annulerMut.mutate(motifAnnul.trim() || null, {
                      onSuccess: () => {
                        setMotifAnnul("");
                        setOpenAnnul(false);
                      },
                      onError: () => setOpenAnnul(false),
                    });
                  }}
                >
                  {annulerMut.isPending ? "Annulation…" : "Confirmer l'annulation"}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Can>
      ) : (
        <span className="text-xs text-muted-foreground">
          Impossible d'annuler ce colisage car il est déjà pris en charge par le service logistique.
        </span>
      )}

      {suppressible && (
        <Can permission="colisage.supprimer">
          <Button variant="destructive" size="sm" onClick={() => setOpenSuppr(true)}>
            {isSuperAdmin ? "Supprimer définitivement" : "Supprimer le colisage"}
          </Button>
          <ConfirmDeleteDialog
            open={openSuppr}
            onOpenChange={setOpenSuppr}
            title={
              isSuperAdmin
                ? `Suppression définitive du colisage ${blReference}`
                : `Supprimer le colisage ${blReference} ?`
            }
            entityLabel="le colisage"
            entityName={blReference}
            description={
              isSuperAdmin
                ? "Action irréversible. Toutes les données de colisage seront supprimées et l'opération sera tracée dans le journal d'audit."
                : "Cette action supprime le colisage. Elle sera enregistrée dans le journal d'audit."
            }
            consequences={[
              "Cartons et lignes de colisage supprimés",
              "Suivi de livraison associé retiré",
              "Livraisons/expéditions détachées du BL",
              "Tournées impactées recalculées",
            ]}
            motifRequired={isSuperAdmin}
            requireTyping={isSuperAdmin ? "SUPPRIMER" : undefined}
            pending={supprMut.isPending}
            onConfirm={(motif) =>
              supprMut.mutate(motif, {
                onSuccess: () => setOpenSuppr(false),
                onError: () => setOpenSuppr(false),
              })
            }
          />
        </Can>
      )}

      {statut === "colisage_termine" && canDeverrouiller && (
        <Can permission="colisage.deverrouiller">
          <AlertDialog open={openDever} onOpenChange={setOpenDever}>
            <AlertDialogTrigger asChild>
              <Button variant="secondary" size="sm">
                Refaire le colisage
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Déverrouiller le colisage {blReference} ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette opération est <strong>exceptionnelle</strong> et destinée uniquement à
                  corriger une erreur de préparation. Toutes les modifications seront historisées
                  (utilisateur, date, motif, anciennes et nouvelles valeurs). Le colisage sera
                  automatiquement reverrouillé après nouvelle validation.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2">
                <Label>
                  Motif de modification <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  value={motifDever}
                  onChange={(e) => setMotifDever(e.target.value)}
                  placeholder="Ex. : correction du nombre de cartons suite à une erreur de saisie"
                  required
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Retour</AlertDialogCancel>
                <Button
                  type="button"
                  disabled={deverMut.isPending || !motifDever.trim()}
                  onClick={() =>
                    deverMut.mutate(motifDever.trim(), {
                      onSuccess: () => {
                        setMotifDever("");
                        setOpenDever(false);
                      },
                    })
                  }
                >
                  {deverMut.isPending ? "Déverrouillage…" : "Déverrouiller"}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Can>
      )}
    </div>
  );
}
