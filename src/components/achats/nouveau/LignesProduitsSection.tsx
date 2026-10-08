import { Plus, Trash2, PackagePlus, Package } from "lucide-react";
import { ProductCoverThumb } from "@/components/produits/ProductCoverThumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProductSearchSelect } from "@/components/search/ProductSearchSelect";
import { formatFCFA } from "@/lib/format";
import type { Produit } from "@/lib/produits-api";

export type LigneUI = {
  produit_id: string | null;
  reference_produit: string;
  designation: string;
  quantite: number;
  prix_unitaire: number;
  /** Remise en pourcentage (0-100). */
  remise_pct: number;
  cover_path?: string | null;
  cover_thumb_path?: string | null;
};

export const emptyLigne = (): LigneUI => ({
  produit_id: null,
  reference_produit: "",
  designation: "",
  quantite: 0,
  prix_unitaire: 0,
  remise_pct: 0,
});

/** Montant d'une ligne après remise. */
export function montantLigne(l: Pick<LigneUI, "quantite" | "prix_unitaire" | "remise_pct">): number {
  const brut = (l.quantite || 0) * (l.prix_unitaire || 0);
  const pct = Math.min(Math.max(l.remise_pct || 0, 0), 100);
  return Math.round(brut * (1 - pct / 100) * 100) / 100;
}

type Props = {
  lignes: LigneUI[];
  onUpdate: (i: number, patch: Partial<LigneUI>) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
  onPick: (i: number, p: Produit | null) => void;
  onOpenQuickCreate: (i: number) => void;
  qteTotale: number;
  montantTotal: number;
};

export function LignesProduitsSection({
  lignes,
  onUpdate,
  onAdd,
  onRemove,
  onPick,
  onOpenQuickCreate,
  qteTotale,
  montantTotal,
}: Props) {
  return (
    <section className="rounded-md border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">2. Produits livrés</h2>
        <Button type="button" variant="outline" size="sm" onClick={onAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Ajouter une ligne
        </Button>
      </div>

      <div className="overflow-x-auto -mx-5 px-5">
        <Table className="min-w-[800px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-14"></TableHead>
              <TableHead className="w-[30%]">Produit</TableHead>
              <TableHead className="w-32">Référence</TableHead>
              <TableHead className="text-right w-24">Qté *</TableHead>
              <TableHead className="text-right w-36">Prix achat</TableHead>
              <TableHead className="text-right w-28">Remise (%)</TableHead>
              <TableHead className="text-right w-40">Total</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lignes.map((l, i) => (
              <TableRow key={i}>
                <TableCell>
                  <ProductCoverThumb 
                    produit={{ 
                      titre: l.designation, 
                      cover_path: l.produit_id ? (l as any).cover_path : undefined, 
                      cover_thumb_path: l.produit_id ? (l as any).cover_thumb_path : undefined
                    } as any} 
                    size="xs" 
                  />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 min-w-[200px]">
                    <div className="flex-1 min-w-0">
                      <ProductSearchSelect
                        value={l.produit_id}
                        onChange={(_id, produit) => onPick(i, produit)}
                      />
                    </div>
                    <Button aria-label="Créer un nouveau produit"
                      type="button"
                      variant="outline"
                      size="icon"
                      title="Créer un nouveau produit"
                      onClick={() => onOpenQuickCreate(i)}
                      className="h-10 w-10 shrink-0"
                    >
                      <PackagePlus className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs select-all whitespace-nowrap overflow-hidden text-ellipsis" title={l.reference_produit || "—"}>
                  {l.reference_produit || "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={l.quantite || ""}
                    onChange={(e) => onUpdate(i, { quantite: e.target.value === "" ? 0 : Number(e.target.value) })}
                    className="text-right h-10 w-full min-w-[70px] text-base"
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={l.prix_unitaire || ""}
                    onChange={(e) => onUpdate(i, { prix_unitaire: e.target.value === "" ? 0 : Number(e.target.value) })}
                    className="text-right h-10 w-full min-w-[100px] text-base"
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={100}
                    step="0.01"
                    value={l.remise_pct || ""}
                    onChange={(e) =>
                      onUpdate(i, {
                        remise_pct: e.target.value === "" ? 0 : Math.min(Math.max(Number(e.target.value), 0), 100),
                      })
                    }
                    className="text-right h-10 w-full min-w-[80px] text-base"
                  />
                </TableCell>
                <TableCell className="text-right font-semibold whitespace-nowrap min-w-[120px]">
                  {formatFCFA(montantLigne(l))}
                </TableCell>
                <TableCell>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemove(i)}
                    disabled={lignes.length === 1}
                    className="h-10 w-10"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end gap-6 border-t pt-4 text-sm">
        <span className="text-muted-foreground">
          Quantité totale : <span className="font-semibold">{qteTotale}</span>
        </span>
        <span className="text-lg font-bold">Montant total : {formatFCFA(montantTotal)}</span>
      </div>
    </section>
  );
}
