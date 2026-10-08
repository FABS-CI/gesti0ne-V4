import { formatDateTime } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type AuditEntry = {
  audit_id: string;
  action: string;
  actor_email: string | null;
  commentaire: string | null;
  created_at: string;
};

export function TourneeAuditCard({ rows }: { rows: AuditEntry[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Historique / Audit</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-72 overflow-y-auto divide-y text-xs">
          {rows.length === 0 ? (
            <div className="p-3 text-muted-foreground">Aucun événement.</div>
          ) : (
            rows.map((e) => (
              <div key={e.audit_id} className="p-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium capitalize">{e.action}</span>
                  <span className="text-muted-foreground">
                    {formatDateTime(e.created_at)}
                  </span>
                </div>
                <div className="text-muted-foreground">{e.actor_email ?? "—"}</div>
                {e.commentaire && <div className="mt-1">{e.commentaire}</div>}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
