import { MoreHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Menu « ⋯ » en bout de ligne. Le contenu reste monté quand il est fermé
 * (forceMount + masqué) pour que les fenêtres ouvertes depuis une action
 * (solder, FNE…) continuent de fonctionner.
 */
export function RowActionsMenu({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={label} title="Actions">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        forceMount
        className="w-auto min-w-56 p-3 data-[state=closed]:hidden"
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
