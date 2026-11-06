import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TYPES_DEPOT } from "@/lib/depots-api";

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  typeFilter: string;
  onTypeFilterChange: (v: string) => void;
  statutFilter: string;
  onStatutFilterChange: (v: string) => void;
}

export function DepotsFilters({
  search,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  statutFilter,
  onStatutFilterChange,
}: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="relative lg:col-span-2">
        <Input
          placeholder="Rechercher (code, nom, ville, responsable)…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <Select value={typeFilter} onValueChange={onTypeFilterChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous types</SelectItem>
          {TYPES_DEPOT.map((t) => (
            <SelectItem key={t.value} value={t.value}>
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={statutFilter} onValueChange={onStatutFilterChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous statuts</SelectItem>
          <SelectItem value="actif">Actif</SelectItem>
          <SelectItem value="inactif">Inactif</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
