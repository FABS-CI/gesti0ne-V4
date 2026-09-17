import { Inbox, Pencil, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/common/EmptyState";
import { formatFCFA, formatDate } from "@/lib/format";

import type { ColumnDef, ResourceConfig, Row } from "./resource-manager-types";
import { optionMeta } from "./resource-manager-types";

function renderCell(col: ColumnDef, row: Row): ReactNode {
  const v = row[col.name];
  if (col.type === "money") return formatFCFA(Number(v ?? 0));
  if (col.type === "badge") {
    const m = optionMeta(col.options, v);
    return (
      <Badge variant="outline" style={{ color: m?.color, borderColor: m?.color }}>
        {m?.label ?? v ?? "—"}
      </Badge>
    );
  }
  // Les colonnes de date sont affichées en JJ/MM/AAAA, même sans type explicite.
  const isDateCol = col.type === "date" || /date|echeance|échéance|validite|validité/i.test(col.name);
  if (isDateCol) return v ? formatDate(String(v)) : "—";
  return v ?? "—";
}

type Props = {
  config: ResourceConfig;
  rows: Row[];
  isLoading: boolean;
  onEdit: (row: Row) => void;
  onDelete: (id: string) => void;
};

export function ResourceTable({ config, rows, isLoading, onEdit, onDelete }: Props) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            {config.columns.map((c) => (
              <TableHead key={c.name} className={c.align === "right" ? "text-right" : ""}>
                {c.label}
              </TableHead>
            ))}
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell
                colSpan={config.columns.length + 1}
                className="py-8 text-center text-muted-foreground"
              >
                Chargement...
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={config.columns.length + 1} className="py-6">
                <EmptyState
                  variant="rich"
                  icon={Inbox}
                  title="Aucun élément pour le moment"
                  description="Créez votre premier enregistrement pour commencer à alimenter cette liste."
                  className="border-none"
                />
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row[config.idField]}>
                {config.columns.map((c) => (
                  <TableCell
                    key={c.name}
                    className={[
                      c.align === "right" ? "text-right" : "",
                      c.type === "mono" ? "font-mono text-xs" : "",
                    ].join(" ")}
                  >
                    {renderCell(c, row)}
                  </TableCell>
                ))}
                <TableCell className="text-right">
                  {config.rowActions?.map((action) => {
                    const Icon = action.icon;
                    if (action.render) {
                      return <span key={action.label}>{action.render(row)}</span>;
                    }
                    if (action.to) {
                      return (
                        <Button
                          key={action.label}
                          asChild
                          variant="ghost"
                          size="icon"
                          title={action.label}
                        >
                          <a href={action.to(row)}>
                            <Icon className="h-4 w-4" />
                          </a>
                        </Button>
                      );
                    }
                    return (
                      <Button
                        key={action.label}
                        variant="ghost"
                        size="icon"
                        title={action.label}
                        onClick={async () => {
                          if (action.confirm && !confirm(action.confirm(row))) return;
                          if (action.onClick) await action.onClick(row);
                        }}
                      >
                        <Icon className="h-4 w-4" />
                      </Button>
                    );
                  })}
                  {!config.readOnly && (
                    <>
                      <Button variant="ghost" size="icon" onClick={() => onEdit(row)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm("Supprimer cet élément ?")) onDelete(row[config.idField]);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export { renderCell };
