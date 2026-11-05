import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SHORTCUTS_CATALOG } from "@/lib/shortcuts-catalog";
import { useUserActionStats, useShortcutMutations } from "@/hooks/use-smart-shortcuts";
import { usePermissions } from "@/hooks/use-permissions";
import { getRoutePermission } from "@/lib/route-permissions";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function PersonnaliserRaccourcisDialog({ open, onOpenChange }: Props) {
  const { data: stats } = useUserActionStats();
  const { pin, unpin, hide, unhide } = useShortcutMutations();
  const { has, isSuperAdmin } = usePermissions();
  const byKey = new Map((stats ?? []).map((s) => [s.action_key, s]));
  const visible = SHORTCUTS_CATALOG.filter((def) => {
    if (isSuperAdmin) return true;
    if (def.permission && !has(def.permission)) return false;
    const routePerm = getRoutePermission(def.href);
    if (typeof routePerm === "string" && !has(routePerm)) return false;
    return true;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Personnaliser mes raccourcis</DialogTitle>
          <DialogDescription>
            Épinglez vos actions préférées ou retirez celles qui ne vous servent pas. Les raccourcis
            évoluent automatiquement selon vos habitudes.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-3">
          <div className="space-y-2">
            {visible.map((def) => {
              const stat = byKey.get(def.key);
              const pinned = !!stat?.pinned;
              const hidden = !!stat?.hidden;
              return (
                <div
                  key={def.key}
                  className="flex items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-medium">{def.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {def.module}
                        {stat ? ` • ${stat.usage_count} utilisation(s)` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant={pinned ? "default" : "outline"}
                      onClick={() => (pinned ? unpin.mutate(def.key) : pin.mutate(def.key))}
                    >
                      {pinned ? "Désépingler" : "Épingler"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => (hidden ? unhide.mutate(def.key) : hide.mutate(def.key))}
                    >
                      {hidden ? "Afficher" : "Masquer"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
