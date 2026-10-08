import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRightLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { listDepots, createTransfert, getStockProduitDepot } from "@/lib/depots-api";
import { ProductSearchSelect } from "@/components/search/ProductSearchSelect";
import type { Produit } from "@/lib/produits-api";

import { Button } from "@/components/ui/button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { friendlyError } from "@/lib/friendly-error";

export const Route = createFileRoute("/_authenticated/transferts/nouveau")({
  component: NouveauTransfertPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

type LigneForm = {
  produit_id: string;
  quantite: number;
  titre?: string;
  stock_dispo?: number;
};

function NouveauTransfertPage() {
  const navigate = useNavigate();
  const [sourceId, setSourceId] = useState("");
  const [destId, setDestId] = useState("");
  const [transporteur, setTransporteur] = useState("");
  const [motif, setMotif] = useState("");
  const [notes, setNotes] = useState("");
  const [lignes, setLignes] = useState<LigneForm[]>([]);

  const { data: depots = [] } = useQuery({ queryKey: ["depots"], queryFn: listDepots });

  const create = useMutation({
    mutationFn: () =>
      createTransfert({
        depot_source_id: sourceId,
        depot_destination_id: destId,
        transporteur: transporteur || null,
        motif: motif || null,
        notes: notes || null,
        lignes: lignes
          .filter((l) => l.produit_id && l.quantite > 0)
          .map((l) => ({ produit_id: l.produit_id, quantite: l.quantite })),
      }),
    onSuccess: (t) => {
      toast.success(`Transfert ${t.numero} créé`);
      navigate({ to: "/transferts/$transfertId", params: { transfertId: t.transfert_id } });
    },
    onError: (e: unknown) => toast.error(friendlyError(e, "Erreur")),
  });

  function addLigne() {
    setLignes((ls) => [...ls, { produit_id: "", quantite: 1 }]);
  }

  async function pickProduit(idx: number, p: Produit | null) {
    if (!p) {
      setLignes((ls) =>
        ls.map((l, i) =>
          i === idx ? { ...l, produit_id: "", titre: undefined, stock_dispo: undefined } : l,
        ),
      );
      return;
    }
    const stock = sourceId ? await getStockProduitDepot(p.produit_id, sourceId) : 0;
    setLignes((ls) =>
      ls.map((l, i) =>
        i === idx ? { ...l, produit_id: p.produit_id, titre: p.titre, stock_dispo: stock } : l,
      ),
    );
  }

  function setQte(idx: number, q: number) {
    setLignes((ls) => ls.map((l, i) => (i === idx ? { ...l, quantite: q } : l)));
  }

  function removeLigne(idx: number) {
    setLignes((ls) => ls.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="ds-page-title flex items-center gap-2">
          <ArrowRightLeft className="h-6 w-6 text-primary" /> Nouveau transfert
        </h1>
        <p className="text-sm text-muted-foreground">Créer un transfert inter-dépôts</p>
      </div>

      <div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Dépôt source</Label>
          <Select value={sourceId} onValueChange={setSourceId}>
            <SelectTrigger>
              <SelectValue placeholder="Choisir..." />
            </SelectTrigger>
            <SelectContent>
              {depots
                .filter((d) => d.actif)
                .map((d) => (
                  <SelectItem key={d.depot_id} value={d.depot_id}>
                    {d.nom}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Dépôt destination</Label>
          <Select value={destId} onValueChange={setDestId}>
            <SelectTrigger>
              <SelectValue placeholder="Choisir..." />
            </SelectTrigger>
            <SelectContent>
              {depots
                .filter((d) => d.actif && d.depot_id !== sourceId)
                .map((d) => (
                  <SelectItem key={d.depot_id} value={d.depot_id}>
                    {d.nom}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Transporteur</Label>
          <Input value={transporteur} onChange={(e) => setTransporteur(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Motif</Label>
          <Input value={motif} onChange={(e) => setMotif(e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>
      </div>

      <div className="rounded-lg border">
        <div className="flex items-center justify-between p-4">
          <h2 className="font-semibold">Produits à transférer</h2>
          <Button size="sm" variant="outline" onClick={addLigne} disabled={!sourceId}>
            <Plus className="mr-2 h-4 w-4" /> Ajouter
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produit</TableHead>
              <TableHead className="w-32">Stock dispo</TableHead>
              <TableHead className="w-32">Quantité</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lignes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  Aucune ligne — sélectionnez le dépôt source puis ajoutez des produits
                </TableCell>
              </TableRow>
            ) : (
              lignes.map((l, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <ProductSearchSelect
                      value={l.produit_id || null}
                      onChange={(_id, p) => pickProduit(idx, p)}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{l.stock_dispo ?? "—"}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={1}
                      value={l.quantite}
                      onChange={(e) => setQte(idx, parseInt(e.target.value) || 0)}
                    />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => removeLigne(idx)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate({ to: "/transferts" })}>
          Annuler
        </Button>
        <Button
          onClick={() => {
            if (!sourceId || !destId) return toast.error("Sélectionnez les dépôts");
            if (!lignes.length) return toast.error("Ajoutez au moins une ligne");
            create.mutate();
          }}
          disabled={create.isPending}
        >
          Créer le transfert
        </Button>
      </div>
    </div>
  );
}
