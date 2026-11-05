import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/friendly-error";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";

type Profile = { id: string; email: string | null; nom: string | null; prenom: string | null };
type Depot = { depot_id: string; nom: string | null; code: string | null; actif: boolean | null };
type Scope = { user_id: string; depot_id: string; principal: boolean | null };

/**
 * Périmètres dépôts (moteur v3).
 * Un utilisateur "portée globale" voit tous les dépôts ; sinon ses accès sont
 * limités aux dépôts cochés ici (fonction SQL `rbac3_scope_depot`).
 */
export function ScopesTabV3({ profiles }: { profiles: Profile[] }) {
  const [depots, setDepots] = useState<Depot[]>([]);
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [d, s] = await Promise.all([
        supabase.from("depots").select("depot_id, nom, code, actif").order("nom"),
        supabase.rpc("rbac3_user_depots_list"),
      ]);
      if (d.error) throw d.error;
      if (s.error) throw s.error;
      setDepots((d.data ?? []) as Depot[]);
      setScopes((s.data ?? []) as Scope[]);
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const granted = useMemo(() => {
    const set = new Set<string>();
    scopes.forEach((s) => set.add(`${s.user_id}:${s.depot_id}`));
    return set;
  }, [scopes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((p) =>
      `${p.prenom ?? ""} ${p.nom ?? ""} ${p.email ?? ""}`.toLowerCase().includes(q),
    );
  }, [profiles, search]);

  const toggle = async (userId: string, depotId: string, next: boolean) => {
    setScopes((cur) =>
      next
        ? [...cur, { user_id: userId, depot_id: depotId, principal: false }]
        : cur.filter((s) => !(s.user_id === userId && s.depot_id === depotId)),
    );
    const { error } = await supabase.rpc("rbac3_user_depot_set", {
      _user_id: userId,
      _depot_id: depotId,
      _next: next,
    });
    if (error) {
      toast.error(friendlyError(error));
      void reload();
    }
  };

  const activeDepots = depots.filter((d) => d.actif !== false);

  return (
    <Card className="p-4">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Input
            placeholder="Rechercher un utilisateur…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Badge variant="secondary">{activeDepots.length} dépôts</Badge>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Un utilisateur sans dépôt coché n'accède qu'aux données non rattachées à un dépôt, sauf si
        son rôle possède la portée globale.
      </p>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <ScrollArea className="h-[60vh]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background">
              <tr>
                <th className="w-64 py-2 text-left font-medium">Utilisateur</th>
                {activeDepots.map((d) => (
                  <th key={d.depot_id} className="px-2 py-2 text-center text-xs font-medium">
                    {d.nom ?? d.code}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="py-2">
                    <div className="truncate font-medium">
                      {[p.prenom, p.nom].filter(Boolean).join(" ") || p.email}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{p.email}</div>
                  </td>
                  {activeDepots.map((d) => (
                    <td key={d.depot_id} className="px-2 py-2 text-center">
                      <Checkbox
                        checked={granted.has(`${p.id}:${d.depot_id}`)}
                        onCheckedChange={(v) => void toggle(p.id, d.depot_id, v === true)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      )}
    </Card>
  );
}
