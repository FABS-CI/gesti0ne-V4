import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveTable } from "@/components/layout/ResponsiveTable";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Issue } from "@/lib/fec-helpers";

function IssueTable({ issues }: { issues: Issue[] }) {
  return (
    <ResponsiveTable stickyFirstCol>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Ligne</TableHead>
            <TableHead className="w-40">Référence</TableHead>
            <TableHead className="w-40">Champ</TableHead>
            <TableHead>Détail</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {issues.map((it, i) => (
            <TableRow key={i}>
              <TableCell className="font-mono text-xs">{it.line ?? "—"}</TableCell>
              <TableCell className="font-mono text-xs">{it.reference}</TableCell>
              <TableCell className="text-xs">{it.field}</TableCell>
              <TableCell className="text-xs">{it.message}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ResponsiveTable>
  );
}

export function FecValidationCards({
  blocking,
  warnings,
}: {
  blocking: Issue[];
  warnings: Issue[];
}) {
  return (
    <>
      {blocking.length > 0 && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" /> Erreurs bloquantes ({blocking.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-72 overflow-auto p-0">
            <IssueTable issues={blocking.slice(0, 50)} />
            {blocking.length > 50 && (
              <p className="text-muted-foreground text-sm p-3">
                … et {blocking.length - 50} autres.
              </p>
            )}
          </CardContent>
        </Card>
      )}
      {warnings.length > 0 && (
        <Card className="border-warning/40">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-warning">
              <AlertTriangle className="h-4 w-4" /> Avertissements ({warnings.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-72 overflow-auto p-0">
            <IssueTable issues={warnings.slice(0, 50)} />
          </CardContent>
        </Card>
      )}
    </>
  );
}
