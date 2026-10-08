import type { ReactNode } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TYPE_CLIENTS } from "@/lib/company";
import { useUserRoles } from "@/hooks/use-user-roles";

interface Props {
  search: string;
  setSearch: (v: string) => void;
  typeFilter: string;
  setTypeFilter: (v: string) => void;
  actifFilter: string;
  setActifFilter: (v: string) => void;
  actifsExercice: boolean;
  setActifsExercice: (v: boolean) => void;
  onAnyChange: () => void;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  actions?: ReactNode;
}

export function ClientsFilters(p: Props) {
  // « Actif dans l'exercice » est une bascule administrative/comptable :
  // elle n'est visible que pour le Super Administrateur et les profils
  // Finance/Comptabilité. Les autres rôles opérationnels ne doivent pas
  // pouvoir masquer des clients avec cette option.
  const { isSuperAdmin, hasAny } = useUserRoles();
  const canManageActifExercice =
    isSuperAdmin || hasAny(["comptable", "directeur_general"]);
  const wrap =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v);
      p.onAnyChange();
    };
  return (
    <>
      <div className="flex flex-wrap items-center gap-3 sticky top-0 z-20 rounded-lg border bg-card p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={p.search}
            onChange={(e) => wrap(p.setSearch)(e.target.value)}
            placeholder="Rechercher un client…"
            className="pl-9"
          />
        </div>
        <Select value={p.typeFilter} onValueChange={wrap(p.setTypeFilter)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {TYPE_CLIENTS.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={p.actifFilter} onValueChange={wrap(p.setActifFilter)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Actifs</SelectItem>
            <SelectItem value="false">Désactivés</SelectItem>
            <SelectItem value="all">Tous</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={p.filtersOpen ? "secondary" : "outline"}
          onClick={p.onToggleFilters}
          aria-expanded={p.filtersOpen}
        >
          <SlidersHorizontal className="mr-2 h-4 w-4" /> Filtres
        </Button>
        {p.actions}
      </div>
      {canManageActifExercice && (
        <div className="flex items-center gap-2">
          <Switch
            id="actifs-exercice"
            checked={p.actifsExercice}
            onCheckedChange={wrap(p.setActifsExercice)}
          />
          <Label htmlFor="actifs-exercice" className="text-sm">
            Actifs dans l'exercice
          </Label>
        </div>
      )}
    </>
  );
}
