import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { VenteRapideDialog } from "@/components/commandes/VenteRapideDialog";
import { Plus, Search, Download, FileDown, SlidersHorizontal, Zap } from "lucide-react";
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
    <div className="flex flex-wrap items-center gap-3 sticky top-0 z-20 rounded-xl border bg-card/95 p-3 shadow-sm backdrop-blur">
      <div className="relative min-w-[200px] flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Rechercher une commande, un client…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
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
          className="h-10 bg-success px-5 font-bold uppercase tracking-wide text-success-foreground shadow-md ring-1 ring-success-foreground/25 hover:bg-success/90"
        >
          <Zap className="mr-2 h-5 w-5" /> VENTE RAPIDE
        </Button>
      )}
      {!readOnly && (
        <Button asChild className="bg-primary hover:bg-primary/90">
          <Link to="/commandes/nouvelle">
            <Plus className="mr-2 h-4 w-4" /> Nouvelle commande
          </Link>
        </Button>
      )}
      <Button
        variant={filtersOpen ? "secondary" : "outline"}
        onClick={onToggleFilters}
        aria-expanded={filtersOpen}
      >
        <SlidersHorizontal className="mr-2 h-4 w-4" /> Filtres
      </Button>
      <Button variant="outline" onClick={onExportCsv} disabled={!hasItems}>
        <Download className="mr-2 h-4 w-4" /> Exporter
      </Button>
      <Button variant="outline" onClick={onExportPdf} disabled={!hasItems}>
        <FileDown className="mr-2 h-4 w-4" /> PDF
      </Button>
      {venteRapide && <VenteRapideDialog open={venteRapide} onOpenChange={setVenteRapide} />}
    </div>
  );
}
