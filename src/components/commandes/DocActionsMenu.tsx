import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Eye, FileDown, Printer } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function DocActionsMenu({
  label,
  icon: Icon,
  onView,
  onDownload,
  onPrint,
}: {
  label: string;
  icon: LucideIcon;
  onView: () => void;
  onDownload: () => void;
  onPrint: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label={label} variant="ghost" size="icon" title={label}>
          <Icon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onView}>
          <Eye className="mr-2 h-4 w-4" /> Visualiser
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDownload}>
          <FileDown className="mr-2 h-4 w-4" /> Télécharger PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onPrint}>
          <Printer className="mr-2 h-4 w-4" /> Imprimer
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
