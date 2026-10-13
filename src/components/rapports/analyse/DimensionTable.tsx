import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SkeletonTable } from "@/components/ui/skeletons";
import { formatFCFA, formatNumber } from "@/lib/format";
import { formatPct } from "@/lib/rapports-kpi";
import type { AgregatDim } from "@/lib/rapports-api";

/** Tableau classé d'une dimension : libellé, Qté, CA, % du CA, Clients, Factures. */
export function DimensionTable({
  rows,
  isLoading,
  isError,
  labelOf,
  onOpen,
  emptyAction,
}: {
  rows: AgregatDim[] | undefined;
  isLoading: boolean;
  isError: boolean;
  labelOf: (v: string) => string;
  onOpen: (row: AgregatDim) => void;
  emptyAction?: React.ReactNode;
}) {
  if (isLoading) return <SkeletonTable rows={8} cols={6} />;
  if (isError)
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Le rapport n'a pas pu être chargé. Réessayez ou contactez l'administrateur.
      </p>
    );
  const data = [...(rows ?? [])].sort((a, b) => Number(b.ca) - Number(a.ca));
  if (!data.length)
    return (
      <div className="space-y-3 py-10 text-center text-sm text-muted-foreground">
        <p>Aucune vente sur cette période pour les filtres choisis.</p>
        {emptyAction}
      </div>
    );
  const total = data.reduce((s, r) => s + Number(r.ca || 0), 0) || 1;

  return (
    <div className="max-h-[480px] overflow-auto">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-card">
          <TableRow>
            <TableHead className="w-10 text-right">#</TableHead>
            <TableHead>Libellé</TableHead>
            <TableHead className="text-right">Qté</TableHead>
            <TableHead className="text-right">CA</TableHead>
            <TableHead className="w-36">% du CA</TableHead>
            <TableHead className="text-right">Clients</TableHead>
            <TableHead className="text-right">Factures</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((r, i) => {
            const pct = (Number(r.ca || 0) / total) * 100;
            return (
              <TableRow
                key={r.label + i}
                tabIndex={0}
                role="button"
                aria-label={`Détail : ${labelOf(r.label)}`}
                onClick={() => onOpen(r)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpen(r);
                  }
                }}
                className="h-10 cursor-pointer tabular-nums focus-visible:bg-muted focus-visible:outline-none"
              >
                <TableCell className="text-right text-muted-foreground">{i + 1}</TableCell>
                <TableCell className="max-w-[16rem] truncate font-medium">{labelOf(r.label)}</TableCell>
                <TableCell className="text-right">{formatNumber(r.qte)}</TableCell>
                <TableCell className="whitespace-nowrap text-right">{formatFCFA(r.ca)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <span className="block h-full bg-primary" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="w-12 text-right text-xs">{formatPct(pct)}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">{formatNumber(r.nb_clients)}</TableCell>
                <TableCell className="text-right">{formatNumber(r.nb_factures)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
