import { createFileRoute, Link } from "@tanstack/react-router";
import { callRpc } from "@/lib/rpc";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/use-permissions";
import { useExercice, type ExerciceStatut } from "@/contexts/ExerciceContext";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ExercicesTable } from "@/components/exercices/index/ExercicesTable";
import { CloturePreviewDialog } from "@/components/exercices/index/CloturePreviewDialog";
import { EditExerciceDialog } from "@/components/exercices/index/EditExerciceDialog";
import type { EditingExercice, PreviewResult } from "@/components/exercices/index/exercices-shared";

import { COMPARATIF_SEARCH_DEFAULTS } from "@/lib/route-schemas";
import { ListPageHeader } from "@/components/common/list/ListParts";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { friendlyError } from "@/lib/friendly-error";

export const Route = createFileRoute("/_authenticated/exercices/")({
  component: ExercicesPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function ExercicesPage() {
  const qc = useQueryClient();
  const { exercices } = useExercice();
  const { isSuperAdmin, has } = usePermissions();
  const canCloturer = has("exercices.cloturer");
  const canModifier = isSuperAdmin;

  const [previewFor, setPreviewFor] = useState<string | null>(null);
  const [activerSuivant, setActiverSuivant] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editing, setEditing] = useState<EditingExercice | null>(null);
  const [aRouvrir, setARouvrir] = useState<{ exercice_id: string; code: string } | null>(null);
  const [motif, setMotif] = useState("");

  const { data: preview, isFetching: previewLoading } = useQuery<PreviewResult>({
    queryKey: ["cloture-preview", previewFor],
    enabled: !!previewFor,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("preview_cloture_exercice", {
        _exercice_id: previewFor!,
      });
      if (error) throw error;
      return data as unknown as PreviewResult;
    },
  });

  const executerMut = useMutation({
    mutationFn: async () => {
      const { assertPermission } = await import("@/lib/rbac-api");
      await assertPermission("exercices.cloturer");
      const { data, error } = await callRpc("executer_cloture_exercice", {
        _exercice_id: previewFor!,
        _activer_suivant: activerSuivant,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (res: unknown) => {
      const r = res as { exercice_suivant_cree: boolean; nb_fournisseurs_reportes: number };
      toast.success(
        `Exercice clôturé${r.exercice_suivant_cree ? ", exercice suivant créé" : ""}. ${r.nb_fournisseurs_reportes} fournisseur(s) avec achats non payés reportés.`,
      );
      setConfirmOpen(false);
      setPreviewFor(null);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  // Réouverture tracée (motif, auteur, date) : seule voie pour modifier un exercice clôturé.
  const rouvrirMut = useMutation({
    mutationFn: async () => {
      const { error } = await callRpc("compta_rouvrir_exercice", {
        p_exercice_id: aRouvrir!.exercice_id,
        p_motif: motif.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(
        `Exercice ${aRouvrir?.code ?? ""} rouvert : réouverture enregistrée avec son motif.`,
      );
      setARouvrir(null);
      setMotif("");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  const updateMut = useMutation({
    mutationFn: async (payload: EditingExercice) => {
      const { error } = await supabase
        .from("exercices")
        .update({
          code: payload.code,
          date_debut: payload.date_debut,
          date_fin: payload.date_fin,
          statut: payload.statut as ExerciceStatut,
        })
        .eq("exercice_id", payload.exercice_id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Exercice modifié");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["exercices"] });
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  return (
    <div className="space-y-6">
      <ListPageHeader
        overline="Comptabilité"
        title="Exercices comptables"
        description="Gérez les exercices et clôturez-les après contrôle de la comptabilité."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link to="/exercices/rapport">Rapport d'exercice</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/exercices/comparatif" search={COMPARATIF_SEARCH_DEFAULTS}>
                Comparatif
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/exercices/journal">Journal de clôture</Link>
            </Button>
          </>
        }
      />

      <ExercicesTable
        exercices={exercices}
        canModifier={canModifier}
        canCloturer={canCloturer}
        onEdit={setEditing}
        onPreviewCloture={setPreviewFor}
        onRouvrir={(e) => {
          setMotif("");
          setARouvrir(e);
        }}
      />

      <Dialog open={!!aRouvrir} onOpenChange={(o) => !o && setARouvrir(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rouvrir l&apos;exercice {aRouvrir?.code}</DialogTitle>
            <DialogDescription>
              L&apos;exercice redevient modifiable. La réouverture est enregistrée avec son motif,
              son auteur et sa date ; les soldes déjà reportés ne sont pas annulés.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="motif-reouverture">Motif (obligatoire)</Label>
            <Textarea
              id="motif-reouverture"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setARouvrir(null)}>
              Annuler
            </Button>
            <Button
              disabled={rouvrirMut.isPending || motif.trim().length < 5}
              onClick={() => rouvrirMut.mutate()}
            >
              {rouvrirMut.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Rouvrir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CloturePreviewDialog
        open={!!previewFor}
        onOpenChange={(o) => !o && setPreviewFor(null)}
        preview={preview}
        loading={previewLoading}
        activerSuivant={activerSuivant}
        setActiverSuivant={setActiverSuivant}
        onValidate={() => setConfirmOpen(true)}
        submitting={executerMut.isPending}
      />

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la clôture définitive</DialogTitle>
            <DialogDescription>
              L'exercice passera en lecture seule : plus aucune écriture ne pourra y être ajoutée ni
              modifiée, sauf réouverture motivée et tracée.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              disabled={executerMut.isPending}
              onClick={() => executerMut.mutate()}
            >
              {executerMut.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Clôturer définitivement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditExerciceDialog
        editing={editing}
        setEditing={setEditing}
        onSave={() => editing && updateMut.mutate(editing)}
        saving={updateMut.isPending}
      />
    </div>
  );
}
