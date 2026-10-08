import { formatDateTime } from "@/lib/format";
import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type PerUserRow = {
  email: string;
  total: number;
  last: string;
  actions: Record<string, number>;
};

type Props = { perUser: PerUserRow[]; onView: (email: string) => void };

const Row = React.memo(function Row({
  u,
  onView,
}: {
  u: PerUserRow;
  onView: (email: string) => void;
}) {
  return (
    <TableRow>
      <TableCell className="font-medium">{u.email}</TableCell>
      <TableCell className="text-right font-mono">{u.total}</TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {Object.entries(u.actions)
            .slice(0, 5)
            .map(([k, v]) => (
              <Badge key={k} variant="secondary" className="text-xs">
                {k} · {v}
              </Badge>
            ))}
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
        {formatDateTime(u.last)}
      </TableCell>
      <TableCell>
        <Button variant="outline" size="sm" onClick={() => onView(u.email)}>
          Voir historique
        </Button>
      </TableCell>
    </TableRow>
  );
});

export function ByUserTab({ perUser, onView }: Props) {
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Utilisateur</TableHead>
            <TableHead className="text-right">Actions totales</TableHead>
            <TableHead>Répartition</TableHead>
            <TableHead>Dernière activité</TableHead>
            <TableHead className="w-32"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {perUser.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                Aucun utilisateur
              </TableCell>
            </TableRow>
          ) : (
            perUser.map((u) => <Row key={u.email} u={u} onView={onView} />)
          )}
        </TableBody>
      </Table>
    </div>
  );
}
