import { cloneElement, isValidElement, useEffect, useId, useState, type ReactElement } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, X } from "lucide-react";
import { toast } from "sonner";

import { updateClient, type ClientInput, type Client } from "@/lib/clients-api";
import { TYPE_CLIENTS } from "@/lib/company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { friendlyError } from "@/lib/friendly-error";

const MODES_PAIEMENT = [
  { value: "comptant", label: "Comptant" },
  { value: "cheque", label: "Chèque" },
  { value: "virement", label: "Virement" },
  { value: "credit", label: "Crédit" },
  { value: "mobile_money", label: "Mobile Money" },
];

const REGIMES_FISCAUX = [
  { value: "reel_normal", label: "Réel normal" },
  { value: "reel_simplifie", label: "Réel simplifié" },
  { value: "synthetique", label: "Synthétique" },
  { value: "exonere", label: "Exonéré" },
];

function toForm(c: Client): ClientInput {
  return {
    nom: c.nom,
    type_client: c.type_client,
    representant: c.representant ?? "",
    telephone: c.telephone ?? "",
    email: c.email ?? "",
    adresse: c.adresse ?? "",
    quartier: c.quartier ?? "",
    commune: c.commune ?? "",
    ville: c.ville ?? "",
    bp: c.bp ?? "",
    pays: c.pays ?? "Côte d'Ivoire",
    categorie: c.categorie ?? "",
    secteur_activite: c.secteur_activite ?? "",
    nif: c.nif ?? "",
    regime_fiscal: c.regime_fiscal ?? "",
    mode_paiement: c.mode_paiement ?? "comptant",
    delai_paiement: c.delai_paiement ?? 0,
    remise_habituelle: c.remise_habituelle ?? 0,
    plafond_credit: c.plafond_credit ?? 0,
    notes: c.notes ?? "",
  };
}


export function ClientEditSheet({
  client,
  open,
  onOpenChange,
}: {
  client: Client;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<ClientInput>(() => toForm(client));

  useEffect(() => {
    if (open) setForm(toForm(client));
  }, [open, client]);

  const set = <K extends keyof ClientInput>(k: K, v: ClientInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: async () => {
      if (!form.nom?.trim()) throw new Error("Le nom du client est obligatoire");
      if (!form.type_client) throw new Error("Le type de client est obligatoire");
      if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
        throw new Error("Email invalide");
      if ((form.plafond_credit ?? 0) < 0) throw new Error("Plafond de crédit invalide");
      return updateClient(client.client_id, form);
    },
    onSuccess: () => {
      toast.success("Client mis à jour");
      qc.invalidateQueries({ queryKey: ["client", client.client_id] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(`Échec : ${friendlyError(e, "cause non précisée par le serveur. Réessayez dans un instant")}`),
  });

  const handleCancel = () => {
    setForm(toForm(client));
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={(v) => (!v ? handleCancel() : onOpenChange(v))}>
      <SheetContent
        side="right"
        data-testid="client-edit-panel"
        className="w-full overflow-y-auto sm:max-w-2xl"
      >
        <SheetHeader>
          <SheetTitle>Modifier le client</SheetTitle>
          <SheetDescription>
            {client.reference} · {client.nom}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6 pb-24">
          <Section title="Identité">
            <Field label="Nom *" className="sm:col-span-2">
              <Input value={form.nom} onChange={(e) => set("nom", e.target.value)} />
            </Field>
            <Field label="Type *">
              <Select value={form.type_client} onValueChange={(v) => set("type_client", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_CLIENTS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Représentant">
              <Input
                value={form.representant ?? ""}
                onChange={(e) => set("representant", e.target.value)}
              />
            </Field>
          </Section>

          <Section title="Coordonnées">
            <Field label="Téléphone">
              <Input
                value={form.telephone ?? ""}
                onChange={(e) => set("telephone", e.target.value)}
              />
            </Field>

            <Field label="Email">
              <Input
                type="email"
                value={form.email ?? ""}
                onChange={(e) => set("email", e.target.value)}
              />
            </Field>
            <Field label="Adresse" className="sm:col-span-2">
              <Input value={form.adresse ?? ""} onChange={(e) => set("adresse", e.target.value)} />
            </Field>
            <Field label="Ville" testId="field-ville">
              <Input
                data-testid="input-ville"
                value={form.ville ?? ""}
                onChange={(e) => set("ville", e.target.value)}
              />
            </Field>
            <Field label="Commune" testId="field-commune">
              <Input
                data-testid="input-commune"
                value={form.commune ?? ""}
                onChange={(e) => set("commune", e.target.value)}
              />
            </Field>
            <Field label="Quartier">
              <Input
                value={form.quartier ?? ""}
                onChange={(e) => set("quartier", e.target.value)}
              />
            </Field>
            <Field label="BP">
              <Input value={form.bp ?? ""} onChange={(e) => set("bp", e.target.value)} />
            </Field>
            <Field label="Pays">
              <Input value={form.pays ?? ""} onChange={(e) => set("pays", e.target.value)} />
            </Field>
          </Section>

          <Section title="Fiscal & commercial">
            <Field label="Catégorie">
              <Input
                value={form.categorie ?? ""}
                onChange={(e) => set("categorie", e.target.value)}
              />
            </Field>
            <Field label="Secteur d'activité">
              <Input
                value={form.secteur_activite ?? ""}
                onChange={(e) => set("secteur_activite", e.target.value)}
              />
            </Field>
            <Field label="NIF">
              <Input value={form.nif ?? ""} onChange={(e) => set("nif", e.target.value)} />
            </Field>
            <Field label="Régime fiscal">
              <Select
                value={form.regime_fiscal ?? ""}
                onValueChange={(v) => set("regime_fiscal", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {REGIMES_FISCAUX.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Mode de paiement">
              <Select
                value={form.mode_paiement ?? "comptant"}
                onValueChange={(v) => set("mode_paiement", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODES_PAIEMENT.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Délai de paiement (jours)">
              <Input
                type="number"
                value={form.delai_paiement ?? 0}
                onChange={(e) => set("delai_paiement", Number(e.target.value))}
              />
            </Field>
            <Field label="Remise habituelle (%)">
              <Input
                type="number"
                step="0.1"
                value={form.remise_habituelle ?? 0}
                onChange={(e) => set("remise_habituelle", Number(e.target.value))}
              />
            </Field>
            <Field label="Plafond de crédit (FCFA)">
              <Input
                type="number"
                value={form.plafond_credit ?? 0}
                onChange={(e) => set("plafond_credit", Number(e.target.value))}
              />
            </Field>
          </Section>

          <Section title="Notes">
            <Field label="Notes internes" className="sm:col-span-2">
              <Textarea
                value={form.notes ?? ""}
                onChange={(e) => set("notes", e.target.value)}
                rows={4}
              />
            </Field>
          </Section>
        </div>

        <div className="fixed bottom-0 right-0 flex w-full gap-2 border-t bg-background p-4 sm:max-w-2xl">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleCancel}
            disabled={save.isPending}
          >
            <X className="mr-2 h-4 w-4" /> Annuler
          </Button>
          <Button className="flex-1" onClick={() => save.mutate()} disabled={save.isPending}>
            <Save className="mr-2 h-4 w-4" /> {save.isPending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({
  label,
  className,
  children,
  testId,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
  testId?: string;
}) {
  const id = useId();
  const withId = isValidElement(children)
    ? cloneElement(children as ReactElement<{ id?: string }>, { id })
    : children;
  return (
    <div className={`space-y-1.5 ${className ?? ""}`} data-testid={testId}>
      <Label htmlFor={id}>{label}</Label>
      {withId}
    </div>
  );
}
