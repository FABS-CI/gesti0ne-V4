import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  dateFrom: string;
  onDateFromChange: (v: string) => void;
  dateTo: string;
  onDateToChange: (v: string) => void;
  journal: string;
  onJournalChange: (v: string) => void;
  lettrage: string;
  onLettrageChange: (v: string) => void;
}

export function JournalFilters(p: Props) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="relative min-w-[16rem] flex-1">
        <Input
          placeholder="Rechercher (libellé, pièce, lettrage)..."
          value={p.search}
          onChange={(e) => p.onSearchChange(e.target.value)}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Du</label>
        <Input
          type="date"
          value={p.dateFrom}
          onChange={(e) => p.onDateFromChange(e.target.value)}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Au</label>
        <Input type="date" value={p.dateTo} onChange={(e) => p.onDateToChange(e.target.value)} />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Journal</label>
        <Select value={p.journal} onValueChange={p.onJournalChange}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="VT">VT — Ventes</SelectItem>
            <SelectItem value="BQ">BQ — Banque</SelectItem>
            <SelectItem value="CA">CA — Caisse</SelectItem>
            <SelectItem value="OD">OD — Opérations div.</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Lettrage</label>
        <Select value={p.lettrage} onValueChange={p.onLettrageChange}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="lettre">Lettré</SelectItem>
            <SelectItem value="non">Non lettré</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
