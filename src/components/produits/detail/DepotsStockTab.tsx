import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ajusterStockDepot, listDepots, type StockDepot } from "@/lib/depots-api";
import { usePermissions } from "@/hooks/use-permissions";
import { friendlyError } from "@/lib/friendly-error";

export function DepotsStockTab({
  produitId,
  stocksDepots,
}: {
  produitId: string;
  stocksDepots: StockDepot[];
}) {
  const qc = useQueryClient();
  const { has } = usePermissions();
  const canAjuster = has("stock.creer_mouvement");
  const [open, setOpen] = useState(false);
  const [depotId, setDepotId] = useState<string>("");
  const [quantite, setQuantite] = useState<number>(0);
  const [motif, setMotif] = useState<string>("");

  const { data: depots = [] } = useQuery({
    queryKey: ["depots", "ajustement-form"],
    queryFn: () => listDepots(),
    enabled: open,
  });
  const depotsActifs = depots.filter((d) => d.actif);

  const ajusterMut = useMutation({
    mutationFn: () =>
      ajusterStockDepot({
        produit_id: produitId,
        depot_id: depotId,
        nouvelle_quantite: quantite,
        motif: motif || null,
      }),
    onSuccess: () => {
      toast.success("Stock ajusté");
      qc.invalidateQueries({ queryKey: ["produit-stocks-depots", produitId] });
      qc.invalidateQueries({ queryKey: ["produit", produitId] });
      qc.invalidateQueries({ queryKey: ["produit-mouvements", produitId] });
      setOpen(false);
      setMotif("");
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  function openFor(s: StockDepot | null) {
    setDepotId(s?.depot_id ?? "");
    setQuantite(s?.quantite ?? 0);
    setMotif("");
    setOpen(true);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Stock par dépôt</CardTitle>
        {canAjuster && (
          <Button size="sm" variant="outline" onClick={() => openFor(null)}>
            Ajuster un stock
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {stocksDepots.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune répartition</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dépôt</TableHead>
                <TableHead>Code</TableHead>
                <TableHead className="text-right">Quantité</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {stocksDepots.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.depots?.nom ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{s.depots?.code ?? "—"}</TableCell>
                  <TableCell className="text-right font-medium">{s.quantite}</TableCell>
                  <TableCell className="text-right">
                    {canAjuster && (
                      <Button
                        aria-label="Ajuster"
                        size="sm"
                        variant="ghost"
                        onClick={() => openFor(s)}
                        title="Ajuster"
                      >
                        Ajuster
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajuster le stock dépôt</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Dépôt *</Label>
              <Select value={depotId} onValueChange={setDepotId}>
                <SelectTrigger>
                  <SelectValue placeholder="— Sélectionnez un dépôt —" />
                </SelectTrigger>
                <SelectContent>
                  {depotsActifs.map((d) => (
                    <SelectItem key={d.depot_id} value={d.depot_id}>
                      {d.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nouvelle quantité *</Label>
              <Input
                type="number"
                min={0}
                value={quantite}
                onChange={(e) => setQuantite(Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label>Motif</Label>
              <Textarea
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                rows={2}
                placeholder="Ex : inventaire physique, casse, écart constaté…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => {
                if (!depotId) {
                  toast.error("Sélectionnez un dépôt");
                  return;
                }
                ajusterMut.mutate();
              }}
              disabled={ajusterMut.isPending}
            >
              {ajusterMut.isPending ? "Enregistrement…" : "Valider l'ajustement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
