import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";

export function DocActionsMenu({
  label,
  onView,
  onDownload,
  onPrint,
}: {
  label: string;
  /** Ignorée : interface sans icônes décoratives. */
  icon?: unknown;
  onView: () => void;
  onDownload: () => void;
  onPrint: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label={label} variant="ghost" size="sm" title={label}>
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onView}>
          <Eye className="mr-2 h-4 w-4" /> Visualiser
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDownload}>Télécharger PDF</DropdownMenuItem>
        <DropdownMenuItem onClick={onPrint}>Imprimer</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
