import type { UseFormReturn } from "react-hook-form";
import { ClientSearchSelect } from "@/components/search/ClientSearchSelect";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Client } from "@/lib/clients-api";
import type { RetourFormValues } from "@/lib/retours-form";

type Props = {
  form: UseFormReturn<RetourFormValues>;
  applyClient: (c: Client | null) => void;
};

export function ClientSection({ form, applyClient }: Props) {
  return (
    <section className="rounded-md border bg-card p-5 space-y-4 relative overflow-hidden">
      <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-primary" />
      <h2 className="text-lg font-semibold pl-1">1. Client (Établissement)</h2>
      <div>
        <Label className="mb-1 block">
          Rechercher par établissement, représentant, ville ou téléphone
        </Label>
        <ClientSearchSelect
          value={form.watch("client_id")}
          onChange={(id, client) => {
            form.setValue("client_id", id ?? "", { shouldValidate: true });
            applyClient(client);
          }}
          disabled={!!form.watch("client_id") && form.formState.isSubmitSuccessful === false && (form.getValues("client_id")?.length ?? 0) > 0 && !!new URLSearchParams(window.location.search).get('clientId')}
        />
      </div>
      {form.formState.errors.client_id && (
        <p className="text-xs text-destructive">{form.formState.errors.client_id.message}</p>
      )}

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
