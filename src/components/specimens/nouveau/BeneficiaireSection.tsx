import type { UseFormReturn } from "react-hook-form";
import { ClientSearchSelect } from "@/components/search/ClientSearchSelect";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Client } from "@/lib/clients-api";
import type { SpecimenFormValues } from "@/lib/specimens-form";

type Props = {
  form: UseFormReturn<SpecimenFormValues>;
  applyClient: (c: Client | null) => void;
};

export function BeneficiaireSection({ form, applyClient }: Props) {
  return (
    <section className="rounded-md border bg-card p-5 space-y-4">
      <h2 className="text-lg font-semibold">2. Bénéficiaire (Établissement)</h2>
      <div>
        <Label htmlFor="client_id">Client / Établissement *</Label>
        <ClientSearchSelect
          value={form.watch("client_id")}
          onChange={(id, client) => {
            form.setValue("client_id", id ?? "", { shouldValidate: true });
            applyClient(client);
          }}
        />
        {form.formState.errors.client_id && (
          <p className="text-xs text-destructive mt-1">{form.formState.errors.client_id.message}</p>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label>Établissement</Label>
          <Input readOnly {...form.register("etablissement")} />
        </div>
        <div>
          <Label>Représentant</Label>
          <Input readOnly {...form.register("representant_nom")} />
        </div>
        <div>
          <Label>Téléphone</Label>
          <Input readOnly {...form.register("telephone")} />
        </div>
        <div>
          <Label>Ville</Label>
          <Input readOnly {...form.register("ville")} />
        </div>
        <div className="md:col-span-2">
          <Label>Adresse</Label>
          <Input readOnly {...form.register("adresse")} />
        </div>
      </div>
    </section>
  );
}
