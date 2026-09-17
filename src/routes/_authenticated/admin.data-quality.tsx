import { createFileRoute } from "@tanstack/react-router";
import { formatFCFA } from "@/lib/format";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AlertCircle, Users, Package, FileX, RefreshCw, Merge } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUserRoles } from "@/hooks/use-user-roles";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { friendlyError } from "@/lib/friendly-error";

export const Route = createFileRoute("/_authenticated/admin/data-quality")({
  component: DataQualityPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

type Duplicate = {
  nom_normalise: string;
  nb: number;
  client_ids: string[];
  noms: string[];
};
type OrphanBl = {
  bl_id: string;
  reference: string | null;
  statut: string;
  client_id: string | null;
  montant: number | null;
  cree_le: string;
};
type StockEcart = {
  produit_id: string;
  titre: string;
  stock_actuel: number;
  stock_calcule: number;
  ecart: number;
};

function DataQualityPage() {
  const { roles } = useUserRoles();
  const qc = useQueryClient();
  const isSuperAdmin = roles.includes("super_admin");
  const [mergeTarget, setMergeTarget] = useState<Duplicate | null>(null);
  const [keepId, setKeepId] = useState<string>("");

  const dupQ = useQuery({
    queryKey: ["dq", "duplicates"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("report_client_duplicates_v2" as never);
      if (error) throw error;
      return (data ?? []) as Duplicate[];
    },
  });

  const orphanQ = useQuery({
    queryKey: ["dq", "orphans"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("report_bl_orphelins_v2" as never);
      if (error) throw error;
      return (data ?? []) as OrphanBl[];
    },
  });

  const stockQ = useQuery({
    queryKey: ["dq", "stock"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("report_stock_ecarts_v2" as never);
      if (error) throw error;
      return (data ?? []) as StockEcart[];
    },
  });

  const refetchAll = () => {
    qc.invalidateQueries({ queryKey: ["dq"] });
  };

  const openMerge = (d: Duplicate) => {
    setMergeTarget(d);
    setKeepId(d.client_ids[0] ?? "");
  };

  const doMerge = async () => {
    if (!mergeTarget || !keepId) return;
    const dupIds = mergeTarget.client_ids.filter((id) => id !== keepId);
    if (dupIds.length === 0) {
      toast.error("Sélectionnez un client à conserver différent des doublons");
      return;
    }
    const { data, error } = await supabase.rpc(
      "merge_clients" as never,
      {
        _keep_id: keepId,
        _dup_ids: dupIds,
      } as never,
    );
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    toast.success(`Fusion effectuée : ${JSON.stringify(data)}`);
    setMergeTarget(null);
    refetchAll();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Qualité des données</h1>
          <p className="text-sm text-muted-foreground">
            Rapports d'audit : doublons clients, BL orphelins, écarts stock théorique vs mouvements.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refetchAll}>
          <RefreshCw className="h-4 w-4 mr-2" /> Actualiser
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm text-muted-foreground">Doublons clients</CardTitle>
            <Users className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{dupQ.data?.length ?? "—"}</p>
            <p className="text-xs text-muted-foreground">groupes de noms identiques</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm text-muted-foreground">BL orphelins</CardTitle>
            <FileX className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{orphanQ.data?.length ?? "—"}</p>
            <p className="text-xs text-muted-foreground">sans commande liée</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm text-muted-foreground">Écarts stock</CardTitle>
            <Package className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stockQ.data?.length ?? "—"}</p>
            <p className="text-xs text-muted-foreground">produits avec écart</p>
          </CardContent>
        </Card>
      </div>

      {/* Doublons clients */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Doublons clients
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!isSuperAdmin && (
            <div className="flex items-center gap-2 text-xs text-amber-600 mb-3">
              <AlertCircle className="h-4 w-4" />
              La fusion est réservée aux super-admins.
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom normalisé</TableHead>
                <TableHead className="text-right">Occurrences</TableHead>
                <TableHead>Variantes</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dupQ.data?.map((d, i) => (
                <TableRow key={`${d.nom_normalise ?? "dup"}-${i}`}>
                  <TableCell className="font-medium">{d.nom_normalise}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="destructive">{d.nb}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {(d.noms ?? []).join(" • ")}
                  </TableCell>

                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!isSuperAdmin}
                      onClick={() => openMerge(d)}
                    >
                      <Merge className="h-3 w-3 mr-1" /> Fusionner
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {dupQ.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                    Aucun doublon détecté ✓
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* BL orphelins */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileX className="h-5 w-5" /> Bons de livraison sans commande
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Référence</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Créé le</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orphanQ.data?.map((o, i) => (
                <TableRow key={o.bl_id ?? `bl-${i}`}>
                  <TableCell className="font-mono text-xs">
                    {o.reference ?? o.bl_id.slice(0, 8)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{o.statut}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatFCFA(o.montant)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(o.cree_le).toLocaleDateString("fr-FR")}
                  </TableCell>
                </TableRow>
              ))}
              {orphanQ.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                    Aucun BL orphelin ✓
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Écarts stock */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" /> Écarts stock théorique vs mouvements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produit</TableHead>
                <TableHead className="text-right">Stock actuel</TableHead>
                <TableHead className="text-right">Stock calculé</TableHead>
                <TableHead className="text-right">Écart</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stockQ.data?.map((s, i) => (
                <TableRow key={s.produit_id ?? `p-${i}`}>
                  <TableCell>{s.titre}</TableCell>
                  <TableCell className="text-right">{s.stock_actuel}</TableCell>
                  <TableCell className="text-right">{s.stock_calcule}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={Math.abs(s.ecart) > 10 ? "destructive" : "outline"}>
                      {s.ecart > 0 ? `+${s.ecart}` : s.ecart}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {stockQ.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                    Aucun écart détecté ✓
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Merge dialog */}
      <Dialog open={!!mergeTarget} onOpenChange={(o) => !o && setMergeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fusion de clients</DialogTitle>
            <DialogDescription>
              Sélectionnez le client à <b>conserver</b>. Les autres seront supprimés après transfert
              de leurs commandes, factures, BL, proformas et paiements.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-3">
            {mergeTarget?.client_ids.map((id, i) => (
              <label
                key={id}
                className="flex items-center gap-2 border rounded p-2 cursor-pointer hover:bg-muted"
              >
                <input
                  type="radio"
                  name="keep"
                  checked={keepId === id}
                  onChange={() => setKeepId(id)}
                />
                <span className="text-sm">
                  <b>{mergeTarget.noms[i]}</b>{" "}
                  <span className="text-xs text-muted-foreground font-mono">
                    ({id.slice(0, 8)}…)
                  </span>
                </span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeTarget(null)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={doMerge}>
              Fusionner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
