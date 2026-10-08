import type { UseFieldArrayReturn, UseFormReturn } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
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
import { ResponsiveTable } from "@/components/layout/ResponsiveTable";
import { ProductSearchSelect } from "@/components/search/ProductSearchSelect";
import type { Produit } from "@/lib/produits-api";
import type { SpecimenFormValues } from "@/lib/specimens-form";

type Props = {
  form: UseFormReturn<SpecimenFormValues>;
  fa: UseFieldArrayReturn<SpecimenFormValues, "lignes", "id">;
  onProduitChange: (index: number, p: Produit | null) => void;
};

export function LignesProduitsSection({ form, fa, onProduitChange }: Props) {
  const { fields, append, remove } = fa;
  const addLigne = () =>
    append({
      produit_id: "",
      reference_produit: "",
      designation: "",
      stock_dispo: 0,
      quantite: undefined as any,
    });
  return (
    <section className="rounded-md border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">3. Produits remis</h2>
        <Button type="button" variant="outline" size="sm" onClick={addLigne}>
          <Plus className="h-4 w-4 mr-2" />
          Ajouter une ligne
        </Button>
      </div>

      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          Aucun produit. Cliquez sur « Ajouter une ligne ».
        </p>
      ) : (
        <ResponsiveTable stickyFirstCol>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Produit</TableHead>
                <TableHead>Référence</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right w-32">Quantité</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((f, i) => {
                const err = form.formState.errors.lignes?.[i];
                return (
                  <TableRow key={f.id}>
                    <TableCell>
                      <ProductSearchSelect
                        value={form.watch(`lignes.${i}.produit_id`)}
                        onChange={(_id, produit) => onProduitChange(i, produit)}
                      />
                      {err?.produit_id && (
                        <p className="text-xs text-destructive mt-1">{err.produit_id.message}</p>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs select-all" title="Référence produit">
                      {form.watch(`lignes.${i}.reference_produit`) || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {form.watch(`lignes.${i}.stock_dispo`)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min={1}
                        max={form.watch(`lignes.${i}.stock_dispo`) || undefined}
                        {...form.register(`lignes.${i}.quantite`, { valueAsNumber: true })}
                        className="text-right w-24"
                        placeholder=""
                        onFocus={(e) => { if (e.target.value === "0") e.target.value = ""; }}
                      />
                      {err?.quantite && (
                        <p className="text-xs text-destructive mt-1">{err.quantite.message}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button aria-label="Supprimer" type="button" variant="ghost" size="icon" onClick={() => remove(i)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ResponsiveTable>
      )}
      {form.formState.errors.lignes && !Array.isArray(form.formState.errors.lignes) && (
        <p className="text-xs text-destructive">{form.formState.errors.lignes.message as string}</p>
      )}
    </section>
  );
}
