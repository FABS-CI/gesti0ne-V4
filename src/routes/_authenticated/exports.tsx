import { createFileRoute, Link } from "@tanstack/react-router";
import { friendlyError } from '@/lib/friendly-error';
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet, FileText, Archive, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/use-permissions";

import {
  EXPORT_ENTITIES,
  fetchExportRows,
  exportXLSX,
  type ExportEntity,
} from "@/lib/export-api";

import { exportPdf } from "@/lib/export-csv";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/exports")({
  component: ExportsGuard,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function ExportsGuard() {
  const { isSuperAdmin, isLoading } = usePermissions();
  if (isLoading) return null;
  if (!isSuperAdmin) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Accès restreint</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Le module « Export & sauvegarde » est réservé au super administrateur.</p>
            <Button asChild variant="outline">
              <Link to="/">Retour au tableau de bord</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  return <ExportsPage />;
}

function ExportsPage() {
  const [entityKey, setEntityKey] = useState<string>(EXPORT_ENTITIES[0].key);
  const [busy, setBusy] = useState<string | null>(null);
  const entity = EXPORT_ENTITIES.find((e) => e.key === entityKey)!;

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["export-preview", entityKey],
    queryFn: () => fetchExportRows(entity),
    staleTime: 30_000,
  });

  const handle = async (fn: () => void | Promise<void>, label: string) => {
    try {
      setBusy(label);
      await fn();
      toast.success(`${label} téléchargé`);
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(null);
    }
  };




  const preview = rows.slice(0, 10);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="ds-page-title">Export & sauvegarde</h1>
        <p className="text-sm text-muted-foreground">
          Téléchargez vos données au format PDF ou Excel, ou créez une sauvegarde complète.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Export par module</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[220px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Module</label>
              <Select value={entityKey} onValueChange={setEntityKey}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPORT_ENTITIES.map((e) => (
                    <SelectItem key={e.key} value={e.key}>
                      {e.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={isLoading || rows.length === 0 || busy !== null}
                onClick={() =>
                  handle(() => {
                    const headers = Object.keys(rows[0] ?? {});
                    const data = rows.map((r) =>
                      headers.map(
                        (h) => (r as Record<string, unknown>)[h] as string | number | null,
                      ),
                    );
                    exportPdf(entity.label, headers, data);
                  }, "PDF")
                }
              >
                {busy === "PDF" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                PDF
              </Button>
              <Button
                disabled={isLoading || rows.length === 0 || busy !== null}
                onClick={() => handle(() => exportXLSX(entity, rows), "Excel")}
              >
                {busy === "Excel" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                )}
                Excel
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="secondary">{isLoading ? "Chargement…" : `${rows.length} lignes`}</Badge>
            <span className="text-xs text-muted-foreground">
              Limite : 10 000 lignes par export.
            </span>
          </div>

          <PreviewTable entity={entity} rows={preview} loading={isLoading} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Archive className="h-4 w-4" /> Sauvegarde complète (module dédié)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Cette page n'effectue que des exports partiels par module (10 000 lignes maximum). La
            sauvegarde faisant autorité — toutes les tables, les utilisateurs, les fichiers et une
            empreinte d'intégrité — se pilote depuis le module Sauvegarde.
          </p>
          <Button asChild>
            <Link to="/backup">
              <Archive className="h-4 w-4 mr-2" />
              Ouvrir le module Sauvegarde
            </Link>
          </Button>

        </CardContent>
      </Card>
    </div>
  );
}

function PreviewTable({
  entity,
  rows,
  loading,
}: {
  entity: ExportEntity;
  rows: Record<string, unknown>[];
  loading: boolean;
}) {
  if (loading) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Aucune donnée.</p>;
  return (
    <div className="rounded-md border overflow-auto max-h-[420px]">
      <Table>
        <TableHeader>
          <TableRow>
            {entity.columns.map((c) => (
              <TableHead key={c} className="whitespace-nowrap">
                {c}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              {entity.columns.map((c) => (
                <TableCell key={c} className="whitespace-nowrap text-xs">
                  {String(r[c] ?? "")}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
