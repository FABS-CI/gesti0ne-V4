import { formatDateTime } from "@/lib/format";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ACTION_LABEL, ACTION_VARIANT, type AuditRow } from "@/lib/audit-helpers";

type Props = {
  selectedOnlineUser: string | null;
  onClose: () => void;
  selectedUserEvents: AuditRow[];
  onViewAll: () => void;
};

export function OnlineUserDialog({
  selectedOnlineUser,
  onClose,
  selectedUserEvents,
  onViewAll,
}: Props) {
  return (
    <Dialog open={!!selectedOnlineUser} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Fiche utilisateur</DialogTitle>
          <DialogDescription>
            {selectedOnlineUser} — {selectedUserEvents.length} événement(s) récent(s)
          </DialogDescription>
        </DialogHeader>
        {selectedUserEvents[0] && (
          <div className="rounded border bg-muted/30 p-3 text-sm">
            <div className="text-xs uppercase text-muted-foreground">Dernière action</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant={ACTION_VARIANT(selectedUserEvents[0].action)}>
                {ACTION_LABEL[selectedUserEvents[0].action] ?? selectedUserEvents[0].action}
              </Badge>
              <span className="capitalize">{selectedUserEvents[0].table_name}</span>
              <span className="text-muted-foreground">
                · {formatDateTime(selectedUserEvents[0].occurred_at)}
              </span>
            </div>
          </div>
        )}
        <ScrollArea className="h-80 rounded border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Référence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedUserEvents.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {formatDateTime(r.occurred_at)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={ACTION_VARIANT(r.action)} className="text-xs">
                      {ACTION_LABEL[r.action] ?? r.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="capitalize text-xs">{r.table_name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {r.record_ref ?? r.record_id ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={onViewAll}>
            Voir tout l'historique
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
