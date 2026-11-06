import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useBlocker, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertTriangle, Loader2, ShoppingCart, } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
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
import { cn } from "@/lib/utils";
import { TYPE_CLIENTS } from "@/lib/company";
import { VILLES_CI } from "@/lib/ci-locations";
import { createClient, findDuplicateClients, type Client } from "@/lib/clients-api";
import {
  clientRapideSchema,
  telephoneChiffres,
  type ClientRapideValues,
} from "@/lib/client-form-schema";
import type { z } from "zod";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { usePermissions } from "@/hooks/use-permissions";
import { friendlyError } from "@/lib/friendly-error";

type FormInput = z.input<typeof clientRapideSchema>;
type Suite = "fiche" | "commande" | "completer";

/** Types proposés en boutons ; « Autre type » ouvre la liste complète. */
const TYPES_FREQUENTS = [
  "librairie",
  "ecole",
  "epp",
  "college",
  "lycee",
  "groupe_scolaire",
  "distributeur",
  "particulier",
];

const VIDE: FormInput = { nom: "", type_client: "", representant: "", telephone: "", ville: "" };

/** Affichage du téléphone pendant la saisie : 07 59 69 98 11. */
const formaterSaisie = (v: string) => telephoneChiffres(v).slice(0, 10).replace(/(\d{2})(?=\d)/g, "$1 ");

/**
 * Création d'un client en cinq informations (nom, type, représentant, téléphone, ville).
 * Les autres champs (email, adresse, fiscal, conditions…) se complètent depuis la fiche ;
 * le NCC n'est demandé qu'au moment d'une déclaration DGI.
 */
export function ClientRapideForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { has } = usePermissions();
  const [suite, setSuite] = useState<Suite>("fiche");
  const [autreType, setAutreType] = useState(false);

  const form = useForm<FormInput, unknown, ClientRapideValues>({
    resolver: zodResolver(clientRapideSchema) as never,
    defaultValues: VIDE,
    mode: "onTouched",
  });

  const debouncedNom = useDebouncedValue(form.watch("nom"), 400);
  const { data: doublons = [] } = useQuery({
    queryKey: ["client-duplicates", debouncedNom],
    queryFn: () => findDuplicateClients(debouncedNom),
    enabled: debouncedNom.trim().length >= 3,
  });

  useBlocker({
    shouldBlockFn: () => form.formState.isDirty && !form.formState.isSubmitSuccessful,
    withResolver: false,
    enableBeforeUnload: form.formState.isDirty,
  });

  const creer = useMutation({
    mutationFn: (v: ClientRapideValues) =>
      createClient({
        nom: v.nom,
        type_client: v.type_client,
        representant: v.representant?.trim() || null,
        telephone: v.telephone,
        ville: v.ville,
        pays: "Côte d'Ivoire",
      }),
    onSuccess: (client: Client) => {
      toast.success(`Client ${client.nom} créé`);
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-kpis"] });
      const id = client.client_id;
      const go =
        suite === "commande"
          ? navigate({ to: "/commandes/nouvelle", search: { clientId: id } })
          : suite === "completer"
            ? navigate({ to: "/clients/$clientId/modifier", params: { clientId: id } })
            : navigate({ to: "/clients/$clientId", params: { clientId: id } });
      go.catch(() => navigate({ to: "/clients" }));
    },
    onError: (e) => toast.error(friendlyError(e, "Création du client impossible")),
  });

  const envoyer = (s: Suite) => {
    setSuite(s);
    form.handleSubmit((v) => creer.mutate(v))();
  };

  const typeChoisi = form.watch("type_client");
  const typeHorsListe = !!typeChoisi && !TYPES_FREQUENTS.includes(typeChoisi);

  return (
    <Form {...form}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          envoyer("fiche");
        }}
        className="mx-auto max-w-2xl space-y-6 pb-24"
      >
        <div>
          <h1 className="ds-page-title">
            Nouveau client
          </h1>
          <p className="text-sm text-muted-foreground">
            Cinq informations suffisent. Le reste se complète plus tard depuis la fiche du client.
          </p>
        </div>

        <Card>
          <CardContent className="space-y-5 pt-6">
            <FormField
              control={form.control}
              name="nom"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Nom du client<span className="ml-0.5 text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input autoFocus autoComplete="off" placeholder="Librairie Yao Kouakou Romeo" {...field} />
                  </FormControl>
                  <FormMessage />
                  {doublons.length > 0 && (
                    <div className="rounded-md border border-warning/50 bg-warning/10 p-2 text-xs text-warning">
                      <p className="flex items-center gap-1.5 font-medium">
                        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                        Client(s) au nom proche déjà enregistré(s)
                      </p>
                      <ul className="mt-1 list-disc pl-5">
                        {doublons.slice(0, 3).map((d) => (
                          <li key={d.client_id}>
                            {d.nom}
                            {d.ville ? ` — ${d.ville}` : ""}{" "}
                            <span className="font-mono opacity-70">({d.reference})</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type_client"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Type<span className="ml-0.5 text-destructive">*</span>
                  </FormLabel>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Type de client">
                    {TYPES_FREQUENTS.map((v) => {
                      const t = TYPE_CLIENTS.find((x) => x.value === v);
                      const actif = field.value === v;
                      return (
                        <Button
                          key={v}
                          type="button"
                          role="radio"
                          aria-checked={actif}
                          size="sm"
                          variant={actif ? "default" : "outline"}
                          onClick={() => {
                            field.onChange(v);
                            setAutreType(false);
                          }}
                        >
                          {t?.label ?? v}
                        </Button>
                      );
                    })}
                    <Button
                      type="button"
                      size="sm"
                      variant={typeHorsListe || autreType ? "default" : "outline"}
                      onClick={() => setAutreType(true)}
                    >
                      Autre type…
                    </Button>
                  </div>
                  {(autreType || typeHorsListe) && (
                    <Select value={typeHorsListe ? field.value : ""} onValueChange={field.onChange}>
                      <SelectTrigger className="mt-2 sm:w-72">
                        <SelectValue placeholder="Choisir dans la liste complète" />
                      </SelectTrigger>
                      <SelectContent>
                        {TYPE_CLIENTS.filter((t) => !TYPES_FREQUENTS.includes(t.value)).map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="representant"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Représentant</FormLabel>
                    <FormControl>
                      <Input placeholder="Yao Kouakou Romeo" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="telephone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Téléphone<span className="ml-0.5 text-destructive">*</span>
                    </FormLabel>
                    <div className="flex">
                      <span className="inline-flex items-center rounded-l-md border border-r-0 bg-muted px-3 text-sm text-muted-foreground">
                        +225
                      </span>
                      <FormControl>
                        <Input
                          className="rounded-l-none"
                          inputMode="tel"
                          placeholder="07 59 69 98 11"
                          {...field}
                          onChange={(e) => field.onChange(formaterSaisie(e.target.value))}
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="ville"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Ville<span className="ml-0.5 text-destructive">*</span>
                  </FormLabel>
                  <Combobox
                    value={field.value}
                    onChange={(v) => {
                      field.onChange(v ?? "");
                      field.onBlur();
                    }}
                    options={VILLES_CI}
                    placeholder="Choisir ou saisir une ville"
                    emptyText="Ville inconnue : saisissez-la"
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="link"
            className="justify-start px-0"
            disabled={creer.isPending}
            onClick={() => envoyer("completer")}
          >
            Créer et compléter la fiche (email, adresse, NCC…)
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => navigate({ to: "/clients" })}>
              Annuler
            </Button>
            {has("commandes.creer") && (
              <Button
                type="button"
                variant="outline"
                disabled={creer.isPending}
                onClick={() => envoyer("commande")}
              >
                <ShoppingCart className="mr-2 h-4 w-4" aria-hidden="true" />
                Créer et faire une commande
              </Button>
            )}
            <Button type="submit" disabled={creer.isPending} className={cn(creer.isPending && "opacity-80")}>
              {creer.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              Créer le client
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
