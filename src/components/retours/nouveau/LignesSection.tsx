import type { UseFieldArrayReturn, UseFormReturn } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { ProductSearchSelect } from "@/components/search/ProductSearchSelect";
import type { Produit } from "@/lib/produits-api";
import { calcLigneRetour, calcTotauxRetour, type RetourFormValues } from "@/lib/retours-form";
import { MOTIFS_RETOUR, ETATS_PRODUIT_RETOUR } from "@/lib/retours-api";
import { formatFCFA } from "@/lib/format";

type Props = {
  form: UseFormReturn<RetourFormValues>;
  fa: UseFieldArrayReturn<RetourFormValues, "lignes", "id">;
  onProduitChange: (index: number, p: Produit | null) => void;
};

export function LignesSection({ form, fa, onProduitChange }: Props) {
  const { fields, append, remove } = fa;
  const lignes = form.watch("lignes") ?? [];
  const remiseGlobalePct = Number(form.watch("remise_globale_pct") ?? 0);
  const totaux = calcTotauxRetour(lignes, remiseGlobalePct);

  const addLigne = () =>
    append({
      produit_id: "",
      reference_produit: "",
      designation: "",
      quantite: 0,
      prix_unitaire: 0,
      remise_pct: 0,
      etat_produit: "revendable",
      motif: "",
    });

  return (
    <section className="rounded-md border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">3. Produits retournés</h2>
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
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[220px]">Produit</TableHead>
                <TableHead>Référence</TableHead>
                <TableHead className="text-right w-24">Qté</TableHead>
                <TableHead className="text-right w-32">Prix unitaire (FCFA)</TableHead>
                <TableHead className="text-right w-24">Remise %</TableHead>
                <TableHead className="text-right w-32">Total (FCFA)</TableHead>
                <TableHead className="w-40">État</TableHead>
                <TableHead className="w-44">Motif</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((f, i) => {
                const err = form.formState.errors.lignes?.[i];
                const calc = calcLigneRetour(lignes[i] ?? {});
                return (
                  <TableRow key={f.id}>
                    <TableCell>
                      <ProductSearchSelect
                        value={form.watch(`lignes.${i}.produit_id`)}
                        onChange={(_id, produit) => {
                          if (form.getValues("facture_id") && !lignes[i]?.qte_disponible) {
                            toast.warning("Attention : vous ajoutez un produit hors facture d'origine.");
                          }
                          onProduitChange(i, produit);
                        }}
                      />
                      {err?.produit_id && (
                        <p className="text-xs text-destructive mt-1">{err.produit_id.message}</p>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs select-all" title="Référence produit">
                      {form.watch(`lignes.${i}.reference_produit`) || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min={1}
                        {...form.register(`lignes.${i}.quantite`, { valueAsNumber: true })}
                        className="text-right w-full sm:w-24 h-10"
                        placeholder=""
                      />
                      {err?.quantite && (
                        <p className="text-xs text-destructive mt-1">{err.quantite.message}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        {...form.register(`lignes.${i}.prix_unitaire`, { valueAsNumber: true })}
                        className="text-right h-10 min-w-[100px]"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        {...form.register(`lignes.${i}.remise_pct`, { valueAsNumber: true })}
                        className="text-right h-10 min-w-[80px]"
                      />
                      {err?.remise_pct && (
                        <p className="text-xs text-destructive mt-1">{err.remise_pct.message}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatFCFA(calc.net, false)}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={form.watch(`lignes.${i}.etat_produit`) ?? "revendable"}
                        onValueChange={(v) =>
                          form.setValue(
                            `lignes.${i}.etat_produit`,
                            v as "revendable" | "endommage" | "perdu",
                            { shouldValidate: true },
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ETATS_PRODUIT_RETOUR.map((e) => (
                            <SelectItem key={e.value} value={e.value}>
                              {e.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={form.watch(`lignes.${i}.motif`) || ""}
                        onValueChange={(v) =>
                          form.setValue(`lignes.${i}.motif`, v, { shouldValidate: true })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Motif" />
                        </SelectTrigger>
                        <SelectContent>
                          {MOTIFS_RETOUR.map((m) => (
                            <SelectItem key={m.value} value={m.value}>
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
        </div>
      )}

      {fields.length > 0 && (
        <div className="flex justify-end">
          <div className="w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total brut (FCFA)</span>
              <span className="tabular-nums">{formatFCFA(totaux.brut, false)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Remises (FCFA)</span>
              <span className="tabular-nums">- {formatFCFA(totaux.remise, false)}</span>
            </div>
            {remiseGlobalePct > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Remise globale facture ({remiseGlobalePct} %)</span>
                <span className="tabular-nums">- {formatFCFA(totaux.remiseGlobale, false)}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-1 font-semibold">
              <span>Total du retour (FCFA)</span>
              <span className="tabular-nums">{formatFCFA(totaux.net, false)}</span>
            </div>
          </div>
        </div>
      )}

      {form.formState.errors.lignes && !Array.isArray(form.formState.errors.lignes) && (
        <p className="text-xs text-destructive">{form.formState.errors.lignes.message as string}</p>
      )}
    </section>
  );
}
