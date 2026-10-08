import { createFileRoute, Link } from "@tanstack/react-router";
import { formatDate } from "@/lib/format";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, FileSpreadsheet, Plane, Printer, Search } from "lucide-react";

import {
  listEmployesEnConge,
  TYPE_CONGE_LABEL,
  DEPARTEMENT_LABEL,
  type EmployeEnConge,
} from "@/lib/rh-api";
import { exportCsv } from "@/lib/export-csv";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/common/EmptyState";

export const Route = createFileRoute("/_authenticated/conges-en-cours")({
  component: CongesEnCoursPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-destructive">Erreur : {(error as Error).message}</div>
  ),
  notFoundComponent: () => <div className="p-8 text-muted-foreground">Page introuvable.</div>,
});

type SortKey = "nom_complet" | "matricule" | "departement" | "date_debut" | "date_fin" | "jours";
const PAGE_SIZE = 20;

function CongesEnCoursPage() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["conges-en-cours"],
    queryFn: listEmployesEnConge,
  });

  const [search, setSearch] = useState("");
  const q = useDebouncedValue(search, 250);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("date_debut");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.filter((c) => {
      if (typeFilter !== "all" && c.type !== typeFilter) return false;
      if (deptFilter !== "all" && c.departement !== deptFilter) return false;
      if (!needle) return true;
      return (
        c.nom_complet.toLowerCase().includes(needle) ||
        c.matricule.toLowerCase().includes(needle) ||
        (c.poste ?? "").toLowerCase().includes(needle)
      );
    });
  }, [data, q, typeFilter, deptFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const va = (a as Record<string, string | number>)[sortKey] ?? "";
      const vb = (b as Record<string, string | number>)[sortKey] ?? "";
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const types = Array.from(new Set(data.map((c) => c.type)));
  const depts = Array.from(new Set(data.map((c) => c.departement)));

  function toggleSort(k: SortKey) {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  }

  function rowsForExport(items: EmployeEnConge[]) {
    return items.map((c) => [
      c.nom_complet,
      c.matricule,
      DEPARTEMENT_LABEL[c.departement] ?? c.departement,
      c.poste ?? "—",
      TYPE_CONGE_LABEL[c.type] ?? c.type,
      c.date_debut,
      c.date_fin,
      String(c.jours),
      c.statut,
    ]);
  }

  const headers = [
    "Nom",
    "Matricule",
    "Service",
    "Fonction",
    "Type",
    "Début",
    "Fin",
    "Jours",
    "Statut",
  ];

  function handleExportPdf() {
    exportCsv("employes_en_conge.pdf", headers, rowsForExport(sorted), {
      pageTitle: "EMPLOYÉS ACTUELLEMENT EN CONGÉ",
      summary: [
        { label: "Effectif en congé", value: String(sorted.length) },
        { label: "Date d'édition", value: new Date().toLocaleDateString("fr-FR") },
      ],
    });
  }

  async function handleExportExcel() {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rowsForExport(sorted)]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Congés en cours");
    XLSX.writeFile(wb, "employes_en_conge.xlsx");
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="mb-1">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/rh-dashboard">
                <ArrowLeft className="mr-2 h-4 w-4" /> Retour au tableau de bord
              </Link>
            </Button>
          </div>
          <h1 className="ds-page-title flex items-center gap-2">
            <Plane className="h-6 w-6 shrink-0 text-sky-500" /> Employés en congé
          </h1>
          <p className="text-sm text-muted-foreground">
            {sorted.length} employé(s) actuellement en congé approuvé
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={!sorted.length}>
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={!sorted.length}>
            <Download className="mr-2 h-4 w-4" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} disabled={!sorted.length}>
            <Printer className="mr-2 h-4 w-4" /> Imprimer
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 print:hidden">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher (nom, matricule, fonction)…"
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          value={typeFilter}
          onValueChange={(v) => {
            setTypeFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {types.map((t) => (
              <SelectItem key={t} value={t}>
                {TYPE_CONGE_LABEL[t] ?? t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={deptFilter}
          onValueChange={(v) => {
            setDeptFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Service" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les services</SelectItem>
            {depts.map((d) => (
              <SelectItem key={d} value={d}>
                {DEPARTEMENT_LABEL[d] ?? d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead
                k="nom_complet"
                label="Nom"
                sortKey={sortKey}
                sortDir={sortDir}
                onToggle={toggleSort}
              />
              <SortableHead
                k="matricule"
                label="Matricule"
                sortKey={sortKey}
                sortDir={sortDir}
                onToggle={toggleSort}
              />
              <SortableHead
                k="departement"
                label="Service"
                sortKey={sortKey}
                sortDir={sortDir}
                onToggle={toggleSort}
              />
              <TableHead>Fonction</TableHead>
              <TableHead>Type</TableHead>
              <SortableHead
                k="date_debut"
                label="Début"
                sortKey={sortKey}
                sortDir={sortDir}
                onToggle={toggleSort}
              />
              <SortableHead
                k="date_fin"
                label="Fin"
                sortKey={sortKey}
                sortDir={sortDir}
                onToggle={toggleSort}
              />
              <SortableHead
                k="jours"
                label="Jours"
                sortKey={sortKey}
                sortDir={sortDir}
                onToggle={toggleSort}
                align="right"
              />
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                  Chargement…
                </TableCell>
              </TableRow>
            ) : paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-6">
                  <EmptyState
                    variant="rich"
                    icon={Plane}
                    title="Aucun employé en congé actuellement"
                    description="Personne n'est absent au titre d'un congé approuvé sur la période sélectionnée."
                    className="border-none"
                  />
                </TableCell>
              </TableRow>
            ) : (
              paged.map((c) => (
                <TableRow key={c.conge_id}>
                  <TableCell className="font-medium">{c.nom_complet}</TableCell>
                  <TableCell className="font-mono text-xs">{c.matricule}</TableCell>
                  <TableCell>{DEPARTEMENT_LABEL[c.departement] ?? c.departement}</TableCell>
                  <TableCell>{c.poste ?? "—"}</TableCell>
                  <TableCell>{TYPE_CONGE_LABEL[c.type] ?? c.type}</TableCell>
                  <TableCell>{formatDate(c.date_debut)}</TableCell>
                  <TableCell>{formatDate(c.date_fin)}</TableCell>
                  <TableCell className="text-right">{c.jours}</TableCell>
                  <TableCell>
                    <Badge variant="default" style={{ backgroundColor: "#10B981" }}>
                      Approuvé
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-between print:hidden">
          <p className="text-sm text-muted-foreground">
            Page {currentPage} / {pageCount} — {sorted.length} résultat(s)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
            >
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= pageCount}
              onClick={() => setPage(currentPage + 1)}
            >
              Suivant
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function SortableHead({
  k,
  label,
  sortKey,
  sortDir,
  onToggle,
  align,
}: {
  k: SortKey;
  label: string;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onToggle: (k: SortKey) => void;
  align?: "right";
}) {
  const active = sortKey === k;
  return (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <button
        type="button"
        onClick={() => onToggle(k)}
        className="inline-flex items-center gap-1 hover:text-primary"
      >
        {label}
        {active && <span className="text-xs">{sortDir === "asc" ? "▲" : "▼"}</span>}
      </button>
    </TableHead>
  );
}
