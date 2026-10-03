import { useState } from "react";
import { formatFCFA } from "@/lib/format";

import type { UseFormReturn, UseFieldArrayReturn } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  searchFacturesClient,
  getLignesRetournables,
  type FactureRetourOption,
} from "@/lib/retours-api";
import type { RetourFormValues } from "@/lib/retours-form";
import { friendlyError } from "@/lib/friendly-error";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  form: UseFormReturn<RetourFormValues>;
  fa: UseFieldArrayReturn<RetourFormValues, "lignes", "id">;
};

export function DocumentSection({ form, fa }: Props) {
  const clientId = form.watch("client_id");
  const factureId = form.watch("facture_id");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<FactureRetourOption | null>(null);

  const factQ = useQuery({
    queryKey: ["retours-factures", clientId, q],
    queryFn: () => searchFacturesClient(clientId!, q),
    enabled: !!clientId,
  });

  const handleSelect = async (f: FactureRetourOption) => {
    setSelected(f);
    setOpen(false);
    form.setValue("facture_id", f.facture_id, { shouldValidate: true });
    try {
      const [lignes, remiseGlobale] = await Promise.all([
        getLignesRetournables(f.facture_id),
        loadRemiseGlobaleFacture(f.facture_id),
      ]);
      form.setValue("remise_globale_pct", remiseGlobale);
      const usable = lignes.filter((l) => l.qte_disponible > 0);
      if (usable.length === 0) {
        toast.warning("Tous les produits de cette facture ont déjà été retournés");
      }
      fa.replace(
        usable.map((l) => ({
          produit_id: l.produit_id,
          reference_produit: l.reference_produit ?? "",
          designation: l.designation,
          quantite: l.qte_disponible,
          motif: "",
          qte_disponible: l.qte_disponible,
          prix_unitaire: l.prix_unitaire,
          remise_pct: l.remise_pct ?? 0,
          etat_produit: "revendable" as const,
        })),
      );
    } catch (e) {
      toast.error(friendlyError(e));
    }
  };

  const clear = () => {
    setSelected(null);
    form.setValue("facture_id", "", { shouldValidate: true });
    form.setValue("remise_globale_pct", 0);
    fa.replace([]);
  };

  return (
    <section className="rounded-md border bg-card p-5 space-y-3 border-primary/20 bg-primary/5 relative overflow-hidden">
      <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-primary" />
      <h2 className="text-lg font-semibold pl-1">
        0. Document d'origine *
      </h2>
      <p className="text-xs text-muted-foreground">
        Rattachez le retour à une facture pour charger automatiquement les produits retournables,
        calculer le montant du retour et mettre à jour le solde client.
      </p>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Label className="mb-1 block text-destructive-foreground">Facture d'origine obligatoire *</Label>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                disabled={!clientId}
                className={cn(
                  "w-full justify-between font-normal",
                  !selected && "text-muted-foreground",
                )}
              >
                {selected
                  ? `${selected.reference} — ${new Date(selected.date_facture).toLocaleDateString("fr-FR")} — ${formatFCFA(selected.montant_total, false)} FCFA`
                  : clientId
                    ? "Rechercher une facture…"
                    : "Sélectionnez d'abord un client"}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput placeholder="N° facture…" value={q} onValueChange={setQ} />
                <CommandList>
                  <CommandEmpty>
                    {factQ.isLoading ? "Chargement…" : "Aucune facture trouvée"}
                  </CommandEmpty>
                  <CommandGroup>
                    {(factQ.data ?? []).map((f) => (
                      <CommandItem
                        key={f.facture_id}
                        value={f.facture_id}
                        onSelect={() => handleSelect(f)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            factureId === f.facture_id ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <div className="flex-1">
                          <div className="font-medium">{f.reference}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(f.date_facture).toLocaleDateString("fr-FR")} —{" "}
                            {formatFCFA(f.montant_total, false)} FCFA — {f.statut}
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        {selected && (
          <Button type="button" variant="ghost" size="icon" onClick={clear} title="Retirer" aria-label="Retirer">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </section>
  );
}

/** Remise globale enregistrée sur la commande de la facture (affichage ; le serveur la reprend lui-même). */
async function loadRemiseGlobaleFacture(factureId: string): Promise<number> {
  const { data: fac } = await supabase
    .from("factures")
    .select("commande_id")
    .eq("facture_id", factureId)
    .maybeSingle();
  if (!fac?.commande_id) return 0;
  const { data: cmd } = await supabase
    .from("commandes")
    .select("remise_globale_pct")
    .eq("commande_id", fac.commande_id)
    .maybeSingle();
  return Number(cmd?.remise_globale_pct ?? 0);
}
