import { createFileRoute, Link } from "@tanstack/react-router";
import { callRpc } from "@/lib/rpc";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarRange, Loader2 } from "lucide-react";
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
import { ExercicesTable } from "@/components/exercices/index/ExercicesTable";
import { CloturePreviewDialog } from "@/components/exercices/index/CloturePreviewDialog";
import { EditExerciceDialog } from "@/components/exercices/index/EditExerciceDialog";
import type { EditingExercice, PreviewResult } from "@/components/exercices/index/exercices-shared";

import { COMPARATIF_SEARCH_DEFAULTS } from "@/lib/route-schemas";
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
      const r = res as { nb_clients_reportes: number; nb_fournisseurs_reportes: number };
      toast.success(
        `Exercice clôturé. ${r.nb_clients_reportes} client(s) et ${r.nb_fournisseurs_reportes} fournisseur(s) reportés.`,
      );
      setConfirmOpen(false);
      setPreviewFor(null);
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <CalendarRange className="h-6 w-6 text-primary" />
            Exercices comptables
          </h1>
          <p className="text-sm text-muted-foreground">
            Gérez les années scolaires et exécutez la clôture avec report des soldes.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/exercices/rapport">Rapport d'exercice</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/exercices/comparatif" search={COMPARATIF_SEARCH_DEFAULTS}>
              Comparatif
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/exercices/journal">Journal de clôture</Link>
          </Button>
        </div>
      </div>

      <ExercicesTable
        exercices={exercices}
        canModifier={canModifier}
        canCloturer={canCloturer}
        onEdit={setEditing}
        onPreviewCloture={setPreviewFor}
      />

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
              Cette action est irréversible : les soldes seront reportés dans l'exercice suivant, et
              l'exercice courant passera en lecture seule.
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
