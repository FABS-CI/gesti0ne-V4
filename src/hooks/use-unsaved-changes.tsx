import { useBlocker } from "@tanstack/react-router";
import { askConfirm } from "@/components/common/GlobalConfirm";

/**
 * Protège un formulaire long : demande confirmation avant de quitter la page
 * (navigation interne ou fermeture d'onglet) quand des modifications ne sont pas enregistrées.
 */
export function useUnsavedChanges(isDirty: boolean) {
  useBlocker({
    shouldBlockFn: async () => {
      if (!isDirty) return false;
      const leave = await askConfirm({
        title: "Quitter sans enregistrer ?",
        description: "Les modifications de ce formulaire seront perdues.",
        confirmLabel: "Quitter sans enregistrer",
        cancelLabel: "Rester sur la page",
        destructive: true,
      });
      return !leave;
    },
    enableBeforeUnload: isDirty,
  });
}

/** Indicateur discret « Modifications non enregistrées ». */
export function UnsavedIndicator({ dirty }: { dirty: boolean }) {
  if (!dirty) return null;
  return (
    <span role="status" className="mr-auto flex items-center gap-2 text-sm text-warning-foreground">
      <span aria-hidden className="h-2 w-2 rounded-full bg-warning" />
      Modifications non enregistrées
    </span>
  );
}
