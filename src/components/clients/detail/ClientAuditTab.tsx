import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyRow } from "./shared";
import { frDateTime, ACTION_LABEL, ACTION_VARIANT } from "@/lib/client-detail-helpers";
import { getClientAudit } from "@/lib/clients-api";

export function ClientAuditTab({ clientId }: { clientId: string }) {
  const [auditAction, setAuditAction] = useState<string>("all");
  const [auditPage, setAuditPage] = useState(1);
  const auditPageSize = 10;

  const { data: audit, isLoading: auditLoading } = useQuery({
    queryKey: ["client-audit", clientId, auditAction, auditPage],
    queryFn: () =>
      getClientAudit(clientId, {
        action: auditAction === "all" ? undefined : auditAction,
        page: auditPage,
        pageSize: auditPageSize,
      }),
  });

  const auditTotalPages = Math.max(1, Math.ceil((audit?.total ?? 0) / auditPageSize));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Select
          value={auditAction}
          onValueChange={(v) => {
            setAuditAction(v);
            setAuditPage(1);
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Type d'action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les actions</SelectItem>
            <SelectItem value="INSERT">Création</SelectItem>
            <SelectItem value="UPDATE">Modification</SelectItem>
            <SelectItem value="DELETE">Suppression</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{audit?.total ?? 0} événement(s)</span>
      </div>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date & heure</TableHead>
              <TableHead>Utilisateur</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Détails</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {auditLoading ? (
              <EmptyRow cols={4} label="Chargement…" />
            ) : !audit?.items.length ? (
              <EmptyRow cols={4} label="Aucun événement d'audit" />
            ) : (
              audit.items.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {frDateTime(a.created_at)}
                  </TableCell>
                  <TableCell className="text-sm">{a.user_email ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={ACTION_VARIANT[a.action] ?? "secondary"}>
                      {ACTION_LABEL[a.action] ?? a.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-md truncate font-mono text-xs text-muted-foreground">
                    {a.record_id ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {auditTotalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button aria-label="Précédent"
            variant="outline"
            size="icon"
            disabled={auditPage <= 1}
            onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {auditPage} / {auditTotalPages}
          </span>
          <Button aria-label="Suivant"
            variant="outline"
            size="icon"
            disabled={auditPage >= auditTotalPages}
            onClick={() => setAuditPage((p) => Math.min(auditTotalPages, p + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
