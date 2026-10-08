import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Database,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import {
  ENTITIES,
  autoMapHeaders,
  buildTemplateCSV,
  insertBatch,
  type EntityKey,
} from "@/lib/import-api";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { friendlyError } from '@/lib/friendly-error';

export const Route = createFileRoute("/_authenticated/import-donnees")({
  component: ImportDonneesPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

type ParsedRow = Record<string, string>;
type ValidatedRow = {
  index: number;
  raw: ParsedRow;
  ok: boolean;
  errors: string[];
  data?: Record<string, unknown>;
};

function ImportDonneesPage() {
  const [entity, setEntity] = useState<EntityKey>("produits");
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [importing, setImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const cfg = ENTITIES[entity];

  const validated: ValidatedRow[] = useMemo(() => {
    if (rows.length === 0) return [];
    return rows.map((raw, idx) => {
      const mapped: Record<string, unknown> = {};
      for (const col of cfg.columns) {
        const src = mapping[col.key];
        if (src) mapped[col.key] = raw[src];
      }
      const res = cfg.validate(mapped);
      if (res.ok) return { index: idx, raw, ok: true, errors: [], data: res.data };
      return { index: idx, raw, ok: false, errors: res.errors };
    });
  }, [rows, mapping, cfg]);

  const validCount = validated.filter((v) => v.ok).length;
  const errorCount = validated.length - validCount;

  function reset() {
    setFileName(null);
    setHeaders([]);
    setRows([]);
    setMapping({});
    if (inputRef.current) inputRef.current.value = "";
  }

  function changeEntity(next: EntityKey) {
    setEntity(next);
    if (headers.length > 0) {
      setMapping(autoMapHeaders(headers, ENTITIES[next].columns));
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const { default: Papa } = await import("papaparse");
    Papa.parse<ParsedRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (res) => {
        const hdrs = res.meta.fields ?? [];
        setHeaders(hdrs);
        setRows(
          res.data.filter((r) => Object.values(r).some((v) => String(v ?? "").trim() !== "")),
        );
        setMapping(autoMapHeaders(hdrs, cfg.columns));
        toast.success(`${res.data.length} lignes lues`);
      },
      error: (err) => toast.error(friendlyError(err, "Erreur CSV")),
    });
  }

  function downloadTemplate() {
    const csv = buildTemplateCSV(entity);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `modele_${entity}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function runImport() {
    const ok = validated.filter((v) => v.ok && v.data).map((v) => v.data!);
    if (ok.length === 0) {
      toast.error("Aucune ligne valide à importer");
      return;
    }
    setImporting(true);
    try {
      const { inserted } = await insertBatch(entity, ok);
      toast.success(`${inserted} ${cfg.label.toLowerCase()} importés avec succès`);
      reset();
    } catch (e) {
      toast.error(friendlyError(e, "Échec import"));
    } finally {
      setImporting(false);
    }
  }

  const requiredUnmapped = cfg.columns
    .filter((c) => c.required && !mapping[c.key])
    .map((c) => c.label);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Database className="h-6 w-6 text-[#F97316]" />
          <div>
            <h1 className="ds-page-title">Import de données</h1>
            <p className="text-sm text-muted-foreground">
              Importer en masse produits, clients ou fournisseurs depuis un fichier CSV
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Choisir l'entité &amp; le fichier</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Type de données</label>
              <Select value={entity} onValueChange={(v) => changeEntity(v as EntityKey)}>
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(ENTITIES).map((e) => (
                    <SelectItem key={e.key} value={e.key}>
                      {e.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={downloadTemplate} className="gap-2">
              <Download className="h-4 w-4" /> Modèle CSV
            </Button>
            <Button onClick={() => inputRef.current?.click()} className="gap-2">
              <Upload className="h-4 w-4" /> Choisir un CSV
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={onFile}
            />
            {fileName && (
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileSpreadsheet className="h-4 w-4" /> {fileName}
                <Button variant="ghost" size="sm" onClick={reset}>
                  Réinitialiser
                </Button>
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {headers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>2. Mapping des colonnes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {cfg.columns.map((col) => (
                <div key={col.key} className="space-y-1">
                  <label className="text-xs font-medium">
                    {col.label}
                    {col.required && <span className="text-destructive"> *</span>}
                  </label>
                  <Select
                    value={mapping[col.key] ?? "__none__"}
                    onValueChange={(v) =>
                      setMapping((m) => ({ ...m, [col.key]: v === "__none__" ? null : v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="(ignorer)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Ignorer —</SelectItem>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            {requiredUnmapped.length > 0 && (
              <p className="mt-4 flex items-center gap-2 text-sm text-warning">
                <AlertTriangle className="h-4 w-4" />
                Colonnes obligatoires non mappées : {requiredUnmapped.join(", ")}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {validated.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-3">
              <span>3. Aperçu &amp; validation</span>
              <div className="flex items-center gap-2 text-sm font-normal">
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" /> {validCount} valides
                </Badge>
                {errorCount > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> {errorCount} erreurs
                  </Badge>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead className="w-24">Statut</TableHead>
                    {cfg.columns.slice(0, 5).map((c) => (
                      <TableHead key={c.key}>{c.label}</TableHead>
                    ))}
                    <TableHead>Erreurs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validated.slice(0, 50).map((v) => (
                    <TableRow key={v.index} className={v.ok ? "" : "bg-destructive/5"}>
                      <TableCell className="text-muted-foreground">{v.index + 2}</TableCell>
                      <TableCell>
                        {v.ok ? (
                          <Badge variant="outline" className="gap-1 text-success">
                            <CheckCircle2 className="h-3 w-3" /> OK
                          </Badge>
                        ) : (
                          <Badge variant="destructive">Erreur</Badge>
                        )}
                      </TableCell>
                      {cfg.columns.slice(0, 5).map((c) => {
                        const src = mapping[c.key];
                        return (
                          <TableCell key={c.key} className="max-w-[180px] truncate">
                            {src ? (v.raw[src] ?? "") : ""}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-xs text-destructive">{v.errors.join(" · ")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {validated.length > 50 && (
              <p className="text-xs text-muted-foreground">
                Aperçu limité aux 50 premières lignes — {validated.length} lignes au total seront
                traitées.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={reset} disabled={importing}>
                Annuler
              </Button>
              <Button
                onClick={runImport}
                disabled={importing || validCount === 0 || requiredUnmapped.length > 0}
                className="gap-2"
              >
                {importing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Importer {validCount} ligne{validCount > 1 ? "s" : ""}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
