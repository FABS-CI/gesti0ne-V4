import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatFCFA } from "@/lib/format";
import { friendlyError } from "@/lib/friendly-error";
import {
  getPaiementAllocationsDetail,
  overrideProductAllocation,
  type PaiementAllocationDetail,
} from "@/lib/paiements-api";
import { usePermissions } from "@/hooks/use-permissions";

function frDate(d: string | null | undefined) {
  return d ? new Date(d).toLocaleDateString("fr-FR") : "—";
}

export function PaiementVentilationCard({ paiementId }: { paiementId: string }) {
  const queryClient = useQueryClient();
  const { has } = usePermissions();
  const canEdit = has("paiements.creer");

  const { data: allocations = [], isLoading } = useQuery({
    queryKey: ["paiement-allocations-detail", paiementId],
    queryFn: () => getPaiementAllocationsDetail(paiementId),
  });

  const [editing, setEditing] = useState<PaiementAllocationDetail | null>(null);
  const [montants, setMontants] = useState<Record<string, number>>({});
  const [raison, setRaison] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      overrideProductAllocation(
        editing!.allocation_id,
        Object.entries(montants).map(([ligne_id, montant]) => ({
          ligne_id,
          montant: Number(montant) || 0,
        })),
        raison,
      ),
    onSuccess: () => {
      toast.success("Ventilation corrigée");
      setEditing(null);
      setRaison("");
      queryClient.invalidateQueries({ queryKey: ["paiement-allocations-detail", paiementId] });
    },
    onError: (e: unknown) => toast.error(friendlyError(e, "Erreur")),
  });

  const openEdit = (a: PaiementAllocationDetail) => {
    setEditing(a);
    setRaison("");
    setMontants(Object.fromEntries(a.lignes.map((l) => [l.ligne_id, l.montant])));
  };

  const totalSaisi = Object.values(montants).reduce((s, m) => s + (Number(m) || 0), 0);
  const ecart = editing ? totalSaisi - editing.montant_affecte : 0;

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (!allocations.length) return null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>
            {allocations.length > 1
              ? `Factures réglées (${allocations.length})`
              : "Facture réglée"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {allocations.map((a) => (
            <div key={a.allocation_id} className="rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-mono text-sm">{a.reference ?? a.facture_id}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    du {frDate(a.date_facture)} · total {formatFCFA(a.montant_facture)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-primary">
                    {formatFCFA(a.montant_affecte)}
                  </span>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/factures/$factureId" params={{ factureId: a.facture_id }}>
                      Voir la facture
                    </Link>
                  </Button>
                  {canEdit && a.lignes.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => openEdit(a)}>
                      <Pencil className="mr-2 h-4 w-4" /> Corriger la ventilation
                    </Button>
                  )}
                </div>
              </div>

              {a.lignes.length > 0 && (
                <div className="mt-3 space-y-1">
                  {a.lignes.map((l) => (
                    <div
                      key={l.line_allocation_id}
                      className="flex flex-wrap items-center justify-between gap-2 border-t pt-1 text-sm"
                    >
                      <span className="truncate">
                        {l.designation ?? l.reference_produit ?? "Produit"}
                      </span>
                      <span className="flex items-center gap-2">
                        {l.methode === "manuelle" && (
                          <Badge variant="outline" className="text-[10px]">
                            corrigé
                          </Badge>
                        )}
                        <span className="font-medium">{formatFCFA(l.montant)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Corriger la ventilation par produit</DialogTitle>
            <DialogDescription>
              Le total réparti doit être égal au montant affecté à la facture
              {editing ? ` (${formatFCFA(editing.montant_affecte)})` : ""}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {editing?.lignes.map((l) => (
              <div key={l.ligne_id} className="grid gap-1">
                <Label className="text-xs">
                  {l.designation ?? l.reference_produit ?? "Produit"}
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={montants[l.ligne_id] ?? 0}
                  onChange={(e) =>
                    setMontants((s) => ({ ...s, [l.ligne_id]: Number(e.target.value) }))
                  }
                />
              </div>
            ))}
            <div className="flex justify-between border-t pt-2 text-sm">
              <span>Total réparti</span>
              <span className={Math.abs(ecart) > 0.01 ? "font-semibold text-destructive" : "font-semibold"}>
                {formatFCFA(totalSaisi)}
              </span>
            </div>
            <div className="grid gap-1">
              <Label htmlFor="raison-vent">Raison de la correction *</Label>
              <Textarea
                id="raison-vent"
                rows={2}
                value={raison}
                onChange={(e) => setRaison(e.target.value)}
                placeholder="Justification obligatoire"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Annuler
            </Button>
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !raison.trim() || Math.abs(ecart) > 0.01}
            >
              {mutation.isPending ? "Enregistrement…" : "Enregistrer la correction"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
