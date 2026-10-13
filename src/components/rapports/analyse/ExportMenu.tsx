import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatNumber } from "@/lib/format";

/** Menu unique « Exporter » de la zone d'analyse. */
export function ExportMenu({
  count,
  busy,
  progress,
  onExport,
}: {
  count: number;
  busy: boolean;
  progress?: string;
  onExport: (kind: "xlsx" | "pdf") => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5" disabled={busy || count === 0}>
          <Download className="h-4 w-4" strokeWidth={1.5} aria-hidden />
          {busy && progress ? progress : "Exporter"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 shadow-sm">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          {formatNumber(count)} lignes concernées
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onExport("xlsx")}>Excel (.xlsx)</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onExport("pdf")}>PDF</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
