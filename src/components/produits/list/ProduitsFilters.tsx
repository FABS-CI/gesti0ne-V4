import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIES_PRODUIT } from "@/lib/company";

interface Props {
  search: string;
  setSearch: (v: string) => void;
  catFilter: string;
  setCatFilter: (v: string) => void;
  niveauFilter: string;
  setNiveauFilter: (v: string) => void;
  actifFilter: string;
  setActifFilter: (v: string) => void;
  onAnyChange: () => void;
}

export function ProduitsFilters(p: Props) {
  const wrap =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v);
      p.onAnyChange();
    };
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="relative">
        <Input
          value={p.search}
          onChange={(e) => wrap(p.setSearch)(e.target.value)}
          placeholder="Rechercher…"
        />
      </div>
      <Select value={p.catFilter} onValueChange={wrap(p.setCatFilter)}>
        <SelectTrigger>
          <SelectValue placeholder="Catégorie" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Toutes catégories</SelectItem>
          {CATEGORIES_PRODUIT.map((c) => (
            <SelectItem key={c.value} value={c.value}>
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        value={p.niveauFilter}
        onChange={(e) => wrap(p.setNiveauFilter)(e.target.value)}
        placeholder="Niveau"
      />
      <Select value={p.actifFilter} onValueChange={wrap(p.setActifFilter)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">Actifs</SelectItem>
          <SelectItem value="false">Désactivés</SelectItem>
          <SelectItem value="all">Tous</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
