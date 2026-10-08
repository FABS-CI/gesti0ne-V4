import { AlertTriangle, Package, Plus, Trash2 } from "lucide-react";
import { ProductCoverThumb } from "@/components/produits/ProductCoverThumb";
import type { UseFormReturn, FieldArrayWithId } from "react-hook-form";
import type { UseQueryResult } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import type { CommandeFormValues } from "../CommandeForm";
import { NumberField } from "./NumberField";

export function computeLigne(qte: number, pu: number, remPct: number) {
  const brut = (qte || 0) * (pu || 0);
  const montantRem = Math.round(((brut * (remPct || 0)) / 100) * 100) / 100;
  const totalLigne = brut - montantRem;
  return { brut, montantRem, totalLigne };
}

type Props = {
  form: UseFormReturn<CommandeFormValues>;
  fields: FieldArrayWithId<CommandeFormValues, "lignes", "id">[];
  lignesWatch: CommandeFormValues["lignes"];
  stockQueries: UseQueryResult<number | null | undefined>[];
  overshootIndexes: number[];
  totalArticles: number;
  totalQuantite: number;
  addLigne: () => void;
  remove: (index: number) => void;
  onProduitChange: (index: number, p: Produit | null) => void;
  remiseEnLigneDisabled?: boolean;
};

export function LignesSection({
  form,
  fields,
  lignesWatch,
  stockQueries,
  overshootIndexes,
  totalArticles,
  totalQuantite,
  addLigne,
  remove,
  onProduitChange,
  remiseEnLigneDisabled,
}: Props) {
  const hasOvershoot = overshootIndexes.length > 0;
  return (
    <section className="relative overflow-hidden rounded-md border bg-card p-4 sm:p-5 space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <h2 className="flex min-w-0 items-center gap-2 truncate text-base sm:text-lg font-semibold">
          <Package className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate">
            3. Produits{" "}
            <span className="text-xs font-normal text-muted-foreground">
              ({totalArticles} art. · {totalQuantite} qté)
            </span>
          </span>
        </h2>
        <Button type="button" variant="outline" size="sm" onClick={addLigne} className="shrink-0">
          <Plus className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Ajouter</span>
        </Button>
      </div>

      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          Aucun produit. Cliquez sur « Ajouter ».
        </p>
      ) : (
        <>
          {/* Desktop : tableau */}
          <div className="hidden lg:block w-full">
            <Table className="w-full table-auto [&_th]:px-2 [&_td]:px-2 [&_th]:py-2 [&_td]:py-2 text-xs">
              <TableHeader>
                <TableRow>
                   <TableHead className="w-[50px]">Cover</TableHead>
                   <TableHead className="min-w-[200px]">Produit</TableHead>
                   <TableHead className="w-[100px]">Réf.</TableHead>
 
                   <TableHead className="text-right w-[80px]">Stock</TableHead>
                   <TableHead className="text-right w-[110px]">P.U.</TableHead>
                   <TableHead className="text-right w-[80px]">Rem.%</TableHead>
                   <TableHead className="text-right w-[100px]">Qté</TableHead>
                   <TableHead className="text-right w-[100px]">Remise</TableHead>
                   <TableHead className="text-right w-[110px]">Vente HT</TableHead>
                   <TableHead className="text-right w-[120px]">Total HT</TableHead>
                   <TableHead className="w-[40px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((f, i) => {
                  const err = form.formState.errors.lignes?.[i];
                  const l = lignesWatch[i];
                  const calc = computeLigne(
                    l?.quantite || 0,
                    l?.prix_unitaire || 0,
                    l?.remise_pct || 0,
                  );
                  const stockLive = stockQueries[i]?.data;
                  const stock =
                    typeof stockLive === "number"
                      ? stockLive
                      : (l as { stock_produit?: number | null })?.stock_produit ?? null;
                  const over = typeof stock === "number" && (l?.quantite || 0) > stock;
                  return (
                    <TableRow
                      key={f.id}
                      className={over ? "bg-destructive/5 align-top" : "align-top"}
                    >
                      <TableCell className="py-2">
                        <ProductCoverThumb
                          produit={{
                            titre: l?.designation,
                            cover_path: (l as any)?.cover_path || (l as any)?.produits?.cover_path,
                            cover_thumb_path: (l as any)?.cover_thumb_path || (l as any)?.produits?.cover_thumb_path,
                          }}
                          size="xs"
                        />
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="min-w-0 max-w-[400px] whitespace-normal break-words">
                          <ProductSearchSelect
                            value={l?.produit_id}
                            loadingLabel={l?.designation}
                            onChange={(_id, produit) => onProduitChange(i, produit)}
                          />
                          {err?.produit_id && (
                            <p className="text-xs text-destructive mt-0.5">{err.produit_id.message}</p>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="font-mono text-xs select-all py-3" title="Référence produit">
                        {form.watch(`lignes.${i}.reference_produit`) || "—"}
                      </TableCell>
                      <TableCell className="text-right text-xs py-3">
                        {stock == null ? (
                          "—"
                        ) : (
                          <span className={over ? "text-destructive font-semibold" : ""}>
                            {stock}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <NumberField
                          control={form.control}
                          name={`lignes.${i}.prix_unitaire`}
                          step="0.01"
                          min={0}
                          className="text-right h-10 px-1 min-w-[100px]"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <NumberField
                          control={form.control}
                          name={`lignes.${i}.remise_pct`}
                          step="0.01"
                          min={0}
                          max={100}
                          className="text-right h-10 px-1 min-w-[80px]"
                          disabled={remiseEnLigneDisabled}
                        />
                        {err?.remise_pct && (
                          <p className="text-xs text-destructive mt-0.5 leading-tight">{err.remise_pct.message}</p>
                        )}
                        {remiseEnLigneDisabled && (
                          <p className="text-xs text-warning mt-0.5 leading-tight">Bloqué (RG active)</p>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <NumberField
                          control={form.control}
                          name={`lignes.${i}.quantite`}
                          integer
                           min={0}
                          className={`text-right h-10 px-1 min-w-[80px] ${over ? "border-destructive" : ""}`}
                        />
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground py-3">
                        {formatFCFA(calc.montantRem)}
                      </TableCell>
                      <TableCell className="text-right text-success font-medium py-3">
                        {formatFCFA(calc.brut)}
                      </TableCell>
                      <TableCell className="text-right font-medium py-3">
                        {formatFCFA(calc.totalLigne)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button aria-label="Supprimer" type="button" variant="ghost" size="icon" onClick={() => remove(i)} className="h-8 w-8">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile / tablette : cartes */}
          <div className="lg:hidden space-y-3">
            {fields.map((f, i) => {
              const err = form.formState.errors.lignes?.[i];
              const l = lignesWatch[i];
              const calc = computeLigne(
                l?.quantite || 0,
                l?.prix_unitaire || 0,
                l?.remise_pct || 0,
              );
              const stockLive = stockQueries[i]?.data;
              const stock =
                typeof stockLive === "number"
                  ? stockLive
                  : (l as { stock_produit?: number | null })?.stock_produit ?? null;
              const over = typeof stock === "number" && (l?.quantite || 0) > stock;
              return (
                <div
                  key={f.id}
                  className={`rounded-md border p-3 space-y-3 ${
                    over ? "border-destructive/50 bg-destructive/5" : "bg-background"
                  }`}
                >
                  <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2">
                    <ProductCoverThumb
                      produit={{
                        titre: l?.designation,
                        cover_path: (l as any)?.cover_path || (l as any)?.produits?.cover_path,
                        cover_thumb_path: (l as any)?.cover_thumb_path || (l as any)?.produits?.cover_thumb_path,
                      }}
                      size="sm"
                      className="mt-5"
                    />
                    <div className="min-w-0 space-y-1">
                      <Label className="text-xs uppercase text-muted-foreground">
                        Article #{i + 1}
                      </Label>
                      <ProductSearchSelect
                        value={l?.produit_id}
                        loadingLabel={l?.designation}
                        onChange={(_id, produit) => onProduitChange(i, produit)}
                      />
                      {err?.produit_id && (
                        <p className="text-xs text-destructive">{err.produit_id.message}</p>
                      )}
                    </div>

                    <Button aria-label="Supprimer"
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(i)}
                      className="shrink-0"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="outline" className="font-mono">
                      {form.watch(`lignes.${i}.reference_produit`) || "—"}
                    </Badge>
                    {stock != null && (
                      <Badge variant={over ? "destructive" : "secondary"} className="gap-1">
                        {over && <AlertTriangle className="h-3 w-3" />}
                        Stock : {stock}
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">P.U.</Label>
                      <NumberField
                        control={form.control}
                        name={`lignes.${i}.prix_unitaire`}
                        step="0.01"
                        min={0}
                        className="h-10 text-right"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Rem. %</Label>
                      <NumberField
                        control={form.control}
                        name={`lignes.${i}.remise_pct`}
                        step="0.01"
                        min={0}
                        max={100}
                        className="h-10 text-right"
                        disabled={remiseEnLigneDisabled}
                      />
                      {err?.remise_pct && (
                        <p className="text-xs text-destructive mt-0.5 leading-tight">{err.remise_pct.message}</p>
                      )}
                      {remiseEnLigneDisabled && (
                        <p className="text-xs text-warning mt-0.5 leading-tight">Bloqué (RG active)</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs">Qté</Label>
                      <NumberField
                        control={form.control}
                        name={`lignes.${i}.quantite`}
                        integer
                        min={0}
                        className={`h-10 text-right ${over ? "border-destructive" : ""}`}
                      />
                    </div>
                  </div>

                  <div className="border-t pt-2 flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      Vente {formatFCFA(calc.brut)} · Remise −{formatFCFA(calc.montantRem)}
                    </span>
                    <span className="font-semibold">{formatFCFA(calc.totalLigne)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {hasOvershoot && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 text-destructive text-xs p-3 flex gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            Certaines quantités dépassent le stock disponible (lignes&nbsp;:{" "}
            {overshootIndexes.map((i) => i + 1).join(", ")}). Corrigez avant d'enregistrer.
          </span>
        </div>
      )}

      {form.formState.errors.lignes && !Array.isArray(form.formState.errors.lignes) && (
        <p className="text-xs text-destructive">{form.formState.errors.lignes.message as string}</p>
      )}
    </section>
  );
}
