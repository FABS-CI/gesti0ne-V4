import { formatDateTime } from "@/lib/format";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/friendly-error";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, RefreshCcw } from "lucide-react";

type AuditRow = {
  id: string;
  acteur_email: string | null;
  action: string;
  cible_type: string | null;
  cible_id: string | null;
  role_code: string | null;
  perm_code: string | null;
  nouvelle_valeur: unknown;
  created_at: string;
};

/** Journal immuable des modifications de sécurité (moteur v3). */
export function AuditTabV3() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("rbac3_audit_list", { _limit: 300 });
    setLoading(false);
    if (error) { toast.error(friendlyError(error)); return; }
    setRows((data ?? []) as AuditRow[]);
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Badge variant="secondary">{rows.length} événements</Badge>
        <Button variant="outline" size="sm" onClick={() => void reload()} disabled={loading}>
          <RefreshCcw className="mr-2 h-4 w-4" /> Actualiser
        </Button>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Aucun événement enregistré.</p>
      ) : (
        <ScrollArea className="h-[62vh]">
          <table className="w-full text-sm table-zebra-orange table-print-borders">
            <thead className="sticky top-0 bg-background border-b shadow-sm">
              <tr className="text-left">
                <th className="py-2 font-medium">Date</th>
                <th className="py-2 font-medium">Auteur</th>
                <th className="py-2 font-medium">Action</th>
                <th className="py-2 font-medium">Cible</th>
                <th className="py-2 font-medium">Détail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t align-top">
                  <td className="whitespace-nowrap py-2 text-xs text-muted-foreground">
                    {formatDateTime(r.created_at)}
                  </td>
                  <td className="py-2 text-xs">{r.acteur_email ?? "—"}</td>
                  <td className="py-2"><Badge variant="outline">{r.action}</Badge></td>
                  <td className="py-2 text-xs">
                    {r.role_code ?? r.cible_type ?? "—"}
                    {r.perm_code ? <span className="text-muted-foreground"> · {r.perm_code}</span> : null}
                  </td>
                  <td className="max-w-[320px] truncate py-2 text-xs text-muted-foreground">
                    {r.nouvelle_valeur ? JSON.stringify(r.nouvelle_valeur) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      )}
    </Card>
  );
}
