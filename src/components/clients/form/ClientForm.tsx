import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { useForm } from "react-hook-form";
import type { Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useBlocker, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  AlertTriangle,
  Building2,
  FileText,
  Handshake,
  Loader2,
  MapPin,
  Phone,
  Receipt,
  RotateCcw,
  Save,
  StickyNote,
  Truck,
  UserCircle2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { TYPE_CLIENTS } from "@/lib/company";
import {
  createClient,
  findDuplicateClients,
  getClient,
  updateClient,
  type Client,
} from "@/lib/clients-api";
import {
  clientFormSchema,
  clientToFormValues,
  emptyClientFormValues,
  formValuesToClientInput,
  MODES_PAIEMENT,
  REGIMES_FISCAUX,
  type ClientFormValues,
} from "@/lib/client-form-schema";
import type { z } from "zod";
type FormInput = z.input<typeof clientFormSchema>;
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { friendlyError } from "@/lib/friendly-error";

interface ClientFormProps {
  clientId?: string;
}

export function ClientForm({ clientId }: ClientFormProps) {
  const editing = !!clientId;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createAnother, setCreateAnother] = useState(false);

  const { data: existing, isLoading } = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => getClient(clientId!),
    enabled: editing,
  });

  const defaultValues = useMemo<ClientFormValues>(
    () => (existing ? clientToFormValues(existing) : emptyClientFormValues),
    [existing],
  );

  const form = useForm<FormInput, unknown, ClientFormValues>({
    resolver: zodResolver(clientFormSchema) as never,
    defaultValues,
    mode: "onBlur",
  });

  // Reset quand les données arrivent
  const resetKey = existing?.client_id ?? "new";
  const lastResetRef = useRef<string>("");
  useEffect(() => {
    if (lastResetRef.current === resetKey) return;
    form.reset(defaultValues);
    lastResetRef.current = resetKey;
  }, [resetKey, defaultValues, form]);

  // Doublons (uniquement en création)
  const nomWatch = form.watch("nom");
  const debouncedNom = useDebouncedValue(nomWatch, 400);
  const { data: duplicates = [] } = useQuery({
    queryKey: ["client-duplicates", debouncedNom, clientId],
    queryFn: () => findDuplicateClients(debouncedNom, clientId),
    enabled: !editing && debouncedNom.trim().length >= 3,
  });

  const isDirty = form.formState.isDirty;

  // Confirmation avant de quitter si modifié
  useBlocker({
    shouldBlockFn: () => isDirty && !form.formState.isSubmitSuccessful,
    withResolver: false,
    enableBeforeUnload: isDirty,
  });

  const saveMutation = useMutation({
    mutationFn: async (values: ClientFormValues) => {
      const payload = formValuesToClientInput(values);
      if (editing) {
        // Audit : assuré par le trigger DB `audit_crud_clients` (source unique).
        return await updateClient(clientId!, payload);
      }
      return await createClient(payload);

    },
    onSuccess: (client: Client) => {
      toast.success(editing ? "Client mis à jour" : "Client créé");
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["client", client.client_id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-kpis"] });
      form.reset(clientToFormValues(client));
      if (!editing && createAnother) {
        setCreateAnother(false);
        form.reset(emptyClientFormValues);
        return;
      }
      navigate({ to: "/clients/$clientId", params: { clientId: client.client_id } }).catch(
        () => navigate({ to: "/clients" }),
      );
    },
    onError: (e) => toast.error(friendlyError(e, "Erreur")),
  });

  const onSubmit = form.handleSubmit((values) => saveMutation.mutate(values));

  // Ctrl/Cmd + S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        onSubmit();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onSubmit]);

  if (editing && isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-6 pb-24">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="ds-page-title">
              {editing ? `Modifier ${existing?.nom ?? "le client"}` : "Nouveau client"}
            </h1>
            {existing?.reference ? (
              <p className="text-sm text-muted-foreground">Code client : {existing.reference}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Code client généré automatiquement selon le type (ex. CL-LYC-339)
              </p>
            )}
          </div>
        </div>

        {!editing && duplicates.length > 0 && (
          <div className="rounded-md border border-warning/50 bg-warning/10 p-3 text-sm text-warning">
            <p className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4" />
              {duplicates.length} client(s) au nom similaire
            </p>
            <ul className="mt-1 list-disc pl-5 text-xs">
              {duplicates.slice(0, 5).map((d) => (
                <li key={d.client_id}>
                  {d.nom} <span className="font-mono opacity-70">({d.reference})</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 1. IDENTITÉ */}
          <Card className="overflow-hidden">
            <SectionHeader icon={UserCircle2} title="Identité" color="#3B82F6" />
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <TextField control={form.control} name="nom" label="Nom" required className="sm:col-span-2" />
              <SelectField
                control={form.control}
                name="type_client"
                label="Type de client"
                required
                options={TYPE_CLIENTS.map((t) => ({ value: t.value, label: t.label }))}
              />
              <SelectField
                control={form.control}
                name="statut"
                label="Statut"
                options={[
                  { value: "actif", label: "Actif" },
                  { value: "inactif", label: "Inactif" },
                ]}
              />
              <TextField control={form.control} name="representant" label="Représentant" />
            </CardContent>
          </Card>

          {/* 2. COORDONNÉES */}
          <Card className="overflow-hidden">
            <SectionHeader icon={Phone} title="Coordonnées" color="#0EA5E9" />
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <TextField control={form.control} name="telephone" label="Téléphone" />

              <TextField control={form.control} name="whatsapp" label="WhatsApp" />
              <TextField control={form.control} name="email" label="Email" type="email" />
              <TextField control={form.control} name="site_web" label="Site Web" className="sm:col-span-2" />
            </CardContent>
          </Card>

          {/* 3. ADRESSE */}
          <Card className="overflow-hidden">
            <SectionHeader icon={MapPin} title="Adresse" color="#F97316" />
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <TextField control={form.control} name="pays" label="Pays" />
              <TextField control={form.control} name="ville" label="Ville" />
              <TextField control={form.control} name="commune" label="Commune" />
              <TextField control={form.control} name="quartier" label="Quartier" />
              <TextField control={form.control} name="adresse" label="Adresse complète" className="sm:col-span-2" />
              <TextField control={form.control} name="bp" label="Boîte Postale" />
              <TextField control={form.control} name="gps" label="Coordonnées GPS" placeholder="lat, lng" />
            </CardContent>
          </Card>

          {/* 4. COMMERCIAL */}
          <Card className="overflow-hidden">
            <SectionHeader icon={Building2} title="Informations commerciales" color="#8B5CF6" />
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <TextField control={form.control} name="zone_commerciale" label="Zone commerciale" />
              <TextField control={form.control} name="secteur_activite" label="Secteur d'activité" />
              <TextField control={form.control} name="categorie" label="Catégorie client" />
              <TextField control={form.control} name="canal_vente" label="Canal de vente" />
              <TextField control={form.control} name="circuit_distribution" label="Circuit de distribution" className="sm:col-span-2" />
            </CardContent>
          </Card>

          {/* 5. FISCAL */}
          <Card className="overflow-hidden">
            <SectionHeader icon={Receipt} title="Informations fiscales" color="#14B8A6" />
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <TextField control={form.control} name="nif" label="NIF" />
              <TextField control={form.control} name="rccm" label="RCCM" />
              <TextField control={form.control} name="compte_contribuable" label="Compte contribuable" />
              <TextField control={form.control} name="cnps" label="CNPS" />
              <SelectField
                control={form.control}
                name="regime_fiscal"
                label="Régime fiscal"
                options={REGIMES_FISCAUX}
                allowEmpty
              />
              <SwitchField control={form.control} name="assujetti_tva" label="Assujetti à la TVA" />
            </CardContent>
          </Card>

          {/* 6. CONDITIONS COMMERCIALES */}
          <Card className="overflow-hidden">
            <SectionHeader icon={Handshake} title="Conditions commerciales" color="#EAB308" />
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <SelectField
                control={form.control}
                name="mode_paiement"
                label="Mode de paiement"
                options={MODES_PAIEMENT}
                allowEmpty
              />
              <TextField control={form.control} name="delai_paiement" label="Délai (jours)" type="number" />
              <TextField control={form.control} name="plafond_credit" label="Plafond de crédit" type="number" />
              <TextField control={form.control} name="remise_habituelle" label="Remise habituelle (%)" type="number" />
              <TextField control={form.control} name="devise" label="Devise" />
            </CardContent>
          </Card>

          {/* 7. LIVRAISON */}
          <Card className="overflow-hidden">
            <SectionHeader icon={Truck} title="Livraison" color="#EF4444" />
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <TextField control={form.control} name="adresse_livraison" label="Adresse de livraison" className="sm:col-span-2" />
              <TextField control={form.control} name="zone_livraison" label="Zone de livraison" />
              <TextField control={form.control} name="depot_defaut" label="Dépôt par défaut" />
              <TextField control={form.control} name="moyen_livraison" label="Moyen préféré" className="sm:col-span-2" />
            </CardContent>
          </Card>

          {/* 8. DOCUMENTS (placeholder) */}
          <Card className="overflow-hidden">
            <SectionHeader icon={FileText} title="Documents" color="#64748B" />
            <CardContent>
              <p className="text-sm text-muted-foreground">
                La gestion des pièces jointes (RCCM, NIF, contrat, logo…) sera disponible dans une prochaine mise à jour.
              </p>
            </CardContent>
          </Card>

          {/* 9. NOTES */}
          <Card className="overflow-hidden lg:col-span-2">
            <SectionHeader icon={StickyNote} title="Notes" color="#10B981" />
            <CardContent>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea rows={5} placeholder="Observations, commentaires internes…" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        </div>

        {/* Barre d'actions sticky */}
        <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-end gap-2 border-t bg-background px-4 py-3 sm:mx-0 sm:rounded-lg sm:border sm:px-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate({ to: "/clients" })}
          >
            <X className="mr-2 h-4 w-4" /> Annuler
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => form.reset(defaultValues)}
            disabled={!isDirty || saveMutation.isPending}
          >
            <RotateCcw className="mr-2 h-4 w-4" /> Réinitialiser
          </Button>
          {!editing && (
            <Button
              type="submit"
              variant="secondary"
              disabled={saveMutation.isPending}
              onClick={() => setCreateAnother(true)}
            >
              Enregistrer et créer un autre
            </Button>
          )}
          <Button type="submit" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Enregistrer
          </Button>
        </div>
      </form>
    </Form>
  );
}

// ------- Helpers ---------------------------------------------------------

type Ctrl = Control<FormInput>;

function SectionHeader({
  icon: Icon,
  title,
  color,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  color: string;
}) {
  return (
    <CardHeader className="relative pl-5">
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: color }}
      />
      <CardTitle className="flex items-center gap-2 text-base">
        <span
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-white shadow-sm"
          style={{ backgroundColor: color }}
        >
          <Icon className="h-4 w-4" />
        </span>
        {title}
      </CardTitle>
    </CardHeader>
  );
}

function TextField({
  control,
  name,
  label,
  required,
  type = "text",
  placeholder,
  className,
}: {
  control: Ctrl;
  name: keyof ClientFormValues;
  label: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <FormField
      control={control}
      name={name as never}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>
            {label}
            {required && <span className="ml-0.5 text-destructive">*</span>}
          </FormLabel>
          <FormControl>
            <Input
              type={type}
              placeholder={placeholder}
              {...field}
              value={field.value == null ? "" : String(field.value)}
              onChange={(e) =>
                field.onChange(type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value)
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function SelectField({
  control,
  name,
  label,
  required,
  options,
  allowEmpty,
  className,
}: {
  control: Ctrl;
  name: keyof ClientFormValues;
  label: string;
  required?: boolean;
  options: { value: string; label: string }[];
  allowEmpty?: boolean;
  className?: string;
}) {
  return (
    <FormField
      control={control}
      name={name as never}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>
            {label}
            {required && <span className="ml-0.5 text-destructive">*</span>}
          </FormLabel>
          <Select
            value={(field.value as string) || (allowEmpty ? "__none" : "")}
            onValueChange={(v) => field.onChange(v === "__none" ? "" : v)}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner…" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {allowEmpty && <SelectItem value="__none">—</SelectItem>}
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function SwitchField({
  control,
  name,
  label,
}: {
  control: Ctrl;
  name: keyof ClientFormValues;
  label: string;
}) {
  return (
    <FormField
      control={control}
      name={name as never}
      render={({ field }) => (
        <FormItem className="flex flex-row items-center justify-between rounded-md border p-3">
          <FormLabel className="!mt-0">{label}</FormLabel>
          <FormControl>
            <Switch checked={!!field.value} onCheckedChange={field.onChange} />
          </FormControl>
        </FormItem>
      )}
    />
  );
}