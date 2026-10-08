import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { usePermissions } from "@/hooks/use-permissions";
import { friendlyError } from "@/lib/friendly-error";

export type SuperAdminDeleteButtonProps = {
  /** Async fn that performs the actual delete (calls the RPC). */
  onConfirm: () => Promise<void>;
  /** Entity label shown in the dialog (ex: « la commande CMD-123 »). */
  entityLabel: string;
  /** Query keys to invalidate after a successful deletion. */
  invalidateKeys?: readonly (readonly unknown[])[];
  /** Extra title tooltip. */
  title?: string;
};

export function SuperAdminDeleteButton({
  onConfirm,
  entityLabel,
  invalidateKeys = [],
  title = "Supprimer définitivement (Super Admin)",
}: SuperAdminDeleteButtonProps) {
  const qc = useQueryClient();
  const { isSuperAdmin, isLoading: rolesLoading } = usePermissions();
  const [open, setOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: onConfirm,
    onSuccess: async () => {
      toast.success("Suppression définitive effectuée");
      for (const key of invalidateKeys) {
        await qc.invalidateQueries({ queryKey: key as unknown[] });
      }
      setOpen(false);
    },
    onError: (e: unknown) => {
      toast.error(friendlyError(e, "Suppression impossible"));
    },
  });

  if (rolesLoading || !isSuperAdmin) return null;

  return (
    <>
      <Button aria-label={title} variant="ghost" size="icon" title={title} onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmation de suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Vous êtes sur le point de supprimer définitivement {entityLabel}. Cette opération est
              irréversible et retire toutes les données associées. Voulez-vous continuer ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={mutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                mutation.mutate();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Suppression…
                </>
              ) : (
                "Confirmer la suppression"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
