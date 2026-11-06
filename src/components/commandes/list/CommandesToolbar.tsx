import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { VenteRapideDialog } from "@/components/commandes/VenteRapideDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUTS_COMMANDE } from "@/lib/commandes-api";

export function CommandesToolbar({
  search,
  onSearchChange,
  statut,
  onStatutChange,
  readOnly,
  onExportCsv,
  onExportPdf,
  hasItems,
  filtersOpen,
  onToggleFilters,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  statut: string;
  onStatutChange: (v: string) => void;
  readOnly: boolean;
  onExportCsv: () => void;
  onExportPdf: () => void;
  hasItems: boolean;
  filtersOpen: boolean;
  onToggleFilters: () => void;
}) {
  const [venteRapide, setVenteRapide] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3 sticky top-0 z-20 rounded-lg border bg-card p-3">
      <div className="relative min-w-[200px] flex-1">
        <Input
          placeholder="Rechercher une commande, un client…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <Select value={statut} onValueChange={onStatutChange}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Statut" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous les statuts</SelectItem>
          {STATUTS_COMMANDE.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!readOnly && (
        <Button
          onClick={() => setVenteRapide(true)}
          className="h-10 bg-success px-5 font-bold text-success-foreground shadow-md ring-1 ring-success-foreground/25 hover:bg-success/90"
        >
          VENTE RAPIDE
        </Button>
      )}
      {!readOnly && (
        <Button asChild className="bg-primary hover:bg-primary/90">
          <Link to="/commandes/nouvelle">Nouvelle commande</Link>
        </Button>
      )}
      <Button
        variant={filtersOpen ? "secondary" : "outline"}
        onClick={onToggleFilters}
        aria-expanded={filtersOpen}
      >
        Filtres
      </Button>
      <Button variant="outline" onClick={onExportCsv} disabled={!hasItems}>
        Exporter
      </Button>
      <Button variant="outline" onClick={onExportPdf} disabled={!hasItems}>
        PDF
      </Button>
      {venteRapide && <VenteRapideDialog open={venteRapide} onOpenChange={setVenteRapide} />}
    </div>
  );
}
