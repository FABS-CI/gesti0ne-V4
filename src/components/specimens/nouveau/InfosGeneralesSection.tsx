import type { UseFormReturn } from "react-hook-form";
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
import type { Depot } from "@/lib/depots-api";
import type { SpecimenFormValues } from "@/lib/specimens-form";

type Props = {
  form: UseFormReturn<SpecimenFormValues>;
  depots: Depot[];
};

export function InfosGeneralesSection({ form, depots }: Props) {
  return (
    <section className="rounded-md border bg-card p-5 space-y-4">
      <h2 className="text-lg font-semibold">1. Informations générales</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label>Numéro</Label>
          <Input value="(généré automatiquement)" readOnly disabled />
        </div>
        <div>
          <Label htmlFor="date_envoi">Date *</Label>
          <Input id="date_envoi" type="date" {...form.register("date_envoi")} />
          {form.formState.errors.date_envoi && (
            <p className="text-xs text-destructive mt-1">{form.formState.errors.date_envoi.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="motif">Motif</Label>
          <Input
            id="motif"
            placeholder="Ex : Présentation collection 2026"
            {...form.register("motif")}
          />
        </div>
        <div>
          <Label htmlFor="donneur_nom">Donneur des spécimens *</Label>
          <Input
            id="donneur_nom"
            placeholder="Personne qui remet physiquement"
            {...form.register("donneur_nom")}
          />
          {form.formState.errors.donneur_nom && (
            <p className="text-xs text-destructive mt-1">{form.formState.errors.donneur_nom.message}</p>
          )}
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="observations">Observations</Label>
          <Textarea id="observations" rows={2} {...form.register("observations")} />
        </div>
        <div className="md:col-span-2">
          <Label>Dépôt de sortie *</Label>
          <Select
            value={form.watch("depot_id") ?? ""}
            onValueChange={(v) => form.setValue("depot_id", v, { shouldValidate: true })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choisir un dépôt" />
            </SelectTrigger>
            <SelectContent>
              {depots
                .filter((d) => d.actif)
                .map((d) => (
                  <SelectItem key={d.depot_id} value={d.depot_id}>
                    {d.nom}
                    {d.is_principal ? " — Principal" : ""}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </section>
  );
}
