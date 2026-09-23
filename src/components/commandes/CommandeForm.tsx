import { useEffect, useMemo, useState } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { invalidateCommande, invalidateFacture, invalidateColisage } from "@/lib/cache-invalidation";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Info, Loader2, Percent, Save, User } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import { useServerDraft } from "@/hooks/use-server-draft";
import { DraftRestoreBanner } from "@/components/ui/draft-restore-banner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { getClient, type Client } from "@/lib/clients-api";
import { getProduit, type Produit } from "@/lib/produits-api";
import { getStockProduitDepot } from "@/lib/depots-api";
import { creerCommande, modifierCommande } from "@/lib/commandes-api";
import { newIdempotencyKey } from "@/lib/idempotency";
import { formatFCFA, formatDate } from "@/lib/format";
import { ClientSearchSelect } from "@/components/search/ClientSearchSelect";
import { DepotSortieField } from "@/components/stock/DepotSortieField";
import { NumberField } from "./form/NumberField";
import { InfoCell, SummaryCard } from "./form/SummaryCard";
import { LignesSection, computeLigne } from "./form/LignesSection";
import { friendlyError } from "@/lib/friendly-error";
import { FraisTransportDialog } from "@/components/commandes/FraisTransportDialog";
import type { FraisTransport } from "@/lib/cycle-vente";

const ligneSchema = z.object({
  produit_id: z.string().min(1, "Sélectionnez un produit"),
  reference_produit: z.string().nullable().optional(),
  designation: z.string().min(1, "Désignation requise"),
  quantite: z.number().int().min(1, "Quantité ≥ 1"),
  prix_unitaire: z.number().min(0, "Prix ≥ 0"),
  remise_pct: z.number().min(0).max(100).optional().or(z.literal(undefined)),
  stock_produit: z.number().nullable().optional(),
  cover_path: z.string().nullable().optional(),
  cover_thumb_path: z.string().nullable().optional(),
});

const formSchema = z.object({
  date_commande: z.string().min(1, "Date requise"),
  client_id: z.string().min(1, "Sélectionnez un client"),
  etablissement: z.string().optional(),
  representant_nom: z.string().optional(),
  telephone: z.string().optional(),
  ville: z.string().optional(),
  adresse: z.string().optional(),
  remise_globale_pct: z.number().min(0).max(100).optional().or(z.literal(undefined)),
  taux_tva: z.number().min(0).max(100).optional().or(z.literal(undefined)),
  depot_id: z.string().optional(),
  depot_override_motif: z.string().nullable().optional(),
  appliquer_tva: z.boolean(),
  lignes: z.array(ligneSchema).min(1, "Ajoutez au moins une ligne produit"),
})
  .refine(
    (data) => {
      const hasRemiseLigne = data.lignes.some((l) => (l.remise_pct || 0) > 0);
      const hasRemiseGlobale = (data.remise_globale_pct || 0) > 0;
      return !(hasRemiseLigne && hasRemiseGlobale);
    },
    {
      message: "Il est interdit d'utiliser simultanément une remise globale et des remises en ligne.",
      path: ["remise_globale_pct"],
    }
  );

// On crée aussi un type pour Zod data brut avant transformation/validation du schéma final si nécessaire
type RawFormData = z.input<typeof formSchema>;

export type CommandeFormValues = z.infer<typeof formSchema>;
// @ts-ignore - necessary for react-hook-form to accept the refined schema
type ValidatedCommandeFormValues = z.output<typeof formSchema>;

type Props = {
  mode: "create" | "edit";
  commandeId?: string;
  initialValues?: Partial<CommandeFormValues>;
  presetClientId?: string;
};

export function CommandeForm({ mode, commandeId, initialValues, presetClientId }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { has } = usePermissions();
  const canValiderCommande = has("commandes.valider");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [immediateConfirmOpen, setImmediateConfirmOpen] = useState(false);
  const [fraisTransportOpen, setFraisTransportOpen] = useState(false);
  const [pendingValues, setPendingValues] = useState<CommandeFormValues | null>(null);
  const [recap, setRecap] = useState<{
    commandeId: string;
    commandeRef: string;
    factureRef: string | null;
    factureId: string | null;
    blRef: string | null;
    blId: string | null;
    autoValidated: boolean;
  } | null>(null);

  const form = useForm<CommandeFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date_commande: new Date().toISOString().slice(0, 10),
      client_id: "",
      etablissement: "",
      representant_nom: "",
      telephone: "",
      ville: "",
      adresse: "",
      
      remise_globale_pct: undefined,
      taux_tva: undefined,
      appliquer_tva: false,
      depot_id: "",
      depot_override_motif: null,
      lignes: [],
      ...initialValues,
    },
  });

  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: "lignes",
  });

  const clientId = form.watch("client_id");

  // Préchargement automatique des coordonnées depuis le client sélectionné (création uniquement)
  const applyClientToForm = (c: Client | null) => {
    if (!c) return;
    if (mode !== "create") return;
    form.setValue("etablissement", c.nom ?? "");
    form.setValue("representant_nom", c.representant ?? "");
    form.setValue("telephone", c.telephone ?? "");
    form.setValue("ville", c.ville ?? "");
    form.setValue("adresse", c.adresse ?? "");
  };

  // Préchargement depuis ?clientId=... (création)
  useEffect(() => {
    if (!presetClientId) return;
    if (form.getValues("client_id")) return;
    form.setValue("client_id", presetClientId, { shouldValidate: true });
    getClient(presetClientId)
      .then(applyClientToForm)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetClientId]);

  // --- Totaux (useWatch = souscription réactive, re-render à chaque frappe) ---
  const lignesWatch = useWatch({ control: form.control, name: "lignes" }) ?? [];
  const remiseGlobalePct = useWatch({ control: form.control, name: "remise_globale_pct" });
  const appliquerTva = useWatch({ control: form.control, name: "appliquer_tva" });
  const tauxTvaRaw = useWatch({ control: form.control, name: "taux_tva" }) || 0;
  const tauxTva = appliquerTva ? tauxTvaRaw : 0;

  // Calcul des exclusions mutuelles pour les remises
  const hasRemiseEnLigne = useMemo(() => {
    return (lignesWatch || []).some((l) => (l?.remise_pct || 0) > 0);
  }, [lignesWatch]);

  const hasRemiseGlobale = useMemo(() => {
    return (remiseGlobalePct || 0) > 0;
  }, [remiseGlobalePct]);

  const totaux = useMemo(() => {
    let brut = 0;
    let remisesLignes = 0;
    let htNet = 0;
    for (const l of lignesWatch) {
      const c = computeLigne(l.quantite || 0, l.prix_unitaire || 0, l.remise_pct || 0);
      brut += c.brut;
      remisesLignes += c.montantRem;
      htNet += c.totalLigne;
    }
    const remiseGlobaleMontant = Math.round(((htNet * (remiseGlobalePct || 0)) / 100) * 100) / 100;
    const htApresRG = htNet - remiseGlobaleMontant;
    const tva = Math.round(((htApresRG * tauxTva) / 100) * 100) / 100;
    const ttc = htApresRG + tva;
    return { brut, remisesLignes, htNet, remiseGlobaleMontant, htApresRG, tva, ttc };
  }, [lignesWatch, remiseGlobalePct, tauxTva]);

  // --- Brouillon serveur (reprise de saisie) — création uniquement ---
  const draftWatch = useWatch({ control: form.control }) as Partial<CommandeFormValues>;
  const draft = useServerDraft<Partial<CommandeFormValues>>({
    docType: "commande",
    value: draftWatch,
    enabled: mode === "create",
    isEmpty: (v) => !v.client_id && !(v.lignes ?? []).some((l) => l?.produit_id || l?.designation),
  });



  // Clé d'idempotence stable pour toute la saisie (anti-doublon)
  const idempotencyKey = useMemo(() => newIdempotencyKey("cmd"), []);

  const mutation = useMutation({
    mutationFn: (
      values: CommandeFormValues & {
        auto_validate?: boolean;
        frais_transport?: FraisTransport;
      },
    ) => {
      if (mode === "create" && typeof values.auto_validate !== "boolean") {
        throw new Error("Choisissez « Valider la facture » ou « Mettre en attente »");
      }
      const payload: any = {
        date_commande: values.date_commande,
        client_id: values.client_id,
        client_nom: (values as any).client_nom || selectedClient?.nom || values.etablissement || null,
        etablissement: values.etablissement || null,
        representant_nom: values.representant_nom || null,
        telephone: values.telephone || null,
        ville: values.ville || null,
        adresse: values.adresse || null,
        
        remise_globale_pct: values.remise_globale_pct || 0,
        taux_tva: values.appliquer_tva ? (values.taux_tva || 0) : 0,
        auto_validate: values.auto_validate,
        type_frais_transport: values.frais_transport?.type ?? null,
        montant_frais_transport: values.frais_transport?.type
          ? values.frais_transport.montant
          : null,
        depot_id: values.depot_id || null,
        lignes: values.lignes.map((l) => ({
          produit_id: l.produit_id,
          reference_produit: l.reference_produit ?? null,
          designation: l.designation,
          quantite: l.quantite,
          prix_unitaire: l.prix_unitaire,
          remise_pct: l.remise_pct || 0,
        })),
      };
      if (mode === "edit" && commandeId) return modifierCommande(commandeId, payload);
      return creerCommande({ ...payload, idempotency_key: idempotencyKey });
    },
    onSuccess: async (created, submittedValues) => {
      if (mode === "create") void draft.markConverted();
      const clientId = form.getValues("client_id") ?? undefined;
      invalidateCommande(qc, {
        commandeId: commandeId ?? (created as { commande_id?: string })?.commande_id,
        clientId,
      });

      if (mode === "edit") {
        toast.success("Commande mise à jour");
        navigate({ to: "/commandes" });
        return;
      }

      const cId = (created as { commande_id?: string; reference?: string })?.commande_id;
      const cRef = (created as { commande_id?: string; reference?: string })?.reference ?? "";

      const validationRequested = submittedValues.auto_validate === true;
      console.info("[commande.workflow] Création terminée", {
        commandeId: cId ?? null,
        validationRequested,
        returnedStatus: (created as { statut?: string })?.statut ?? null,
      });

      if (!validationRequested || !cId) {
        toast.success("Commande enregistrée en attente de validation");
        navigate({ to: "/commandes" });
        return;
      }

      // Auto-validation : on va chercher facture + BL générés pour afficher le récap
      const [{ data: fac }, { data: bl }] = await Promise.all([
        supabase
          .from("factures")
          .select("facture_id, reference")
          .eq("commande_id", cId)
          .neq("statut", "annulee")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("bons_livraison")
          .select("bl_id, reference")
          .eq("commande_id", cId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      invalidateFacture(qc, { clientId });
      invalidateColisage(qc, { clientId });

      setRecap({
        commandeId: cId,
        commandeRef: cRef,
        factureRef: (fac as { reference?: string } | null)?.reference ?? null,
        factureId: (fac as { facture_id?: string } | null)?.facture_id ?? null,
        blRef: (bl as { reference?: string } | null)?.reference ?? null,
        blId: (bl as { bl_id?: string } | null)?.bl_id ?? null,
        autoValidated: true,
      });
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  const onSubmit = form.handleSubmit(
    (values: CommandeFormValues) => {
      const typedValues = values as CommandeFormValues;
      if (mode === "create") {
        setPendingValues(typedValues);
        setConfirmOpen(true);
        return;
      }
      mutation.mutate(typedValues);
    },
    () => toast.error("Veuillez corriger les erreurs du formulaire"),
  );

  const confirmSubmit = (validate: boolean = false, frais?: FraisTransport) => {
    if (!pendingValues) return;
    console.info("[commande.workflow] Choix utilisateur confirmé", {
      decision: validate ? "valider_facture" : "mettre_en_attente",
    });
    setConfirmOpen(false);
    mutation.mutate({ 
      ...pendingValues, 
      auto_validate: validate,
      frais_transport: validate ? frais : undefined,
      client_nom: selectedClient?.nom || pendingValues.etablissement || null
    } as any);
  };

  const addLigne = () => {
    append({
      produit_id: "",
      reference_produit: "",
      designation: "",
      quantite: 0,
      prix_unitaire: 0,
      remise_pct: undefined,
      stock_produit: null,
    });
  };

  const onProduitChange = (index: number, p: Produit | null) => {
    if (!p) {
      update(index, {
        produit_id: "",
        reference_produit: "",
        designation: "",
        quantite: form.getValues(`lignes.${index}.quantite`) as any,
        prix_unitaire: 0,
        remise_pct: form.getValues(`lignes.${index}.remise_pct`) || 0,
        stock_produit: null,
      });
      return;
    }
    // Empêcher le même produit sur 2 lignes : fusionner les quantités
    const current = form.getValues("lignes") ?? [];
    const existingIdx = current.findIndex((l, i) => i !== index && l.produit_id === p.produit_id);
    if (existingIdx !== -1) {
      const addQty = form.getValues(`lignes.${index}.quantite`) || 0;
      const existingQty = form.getValues(`lignes.${existingIdx}.quantite`) || 0;
      update(existingIdx, {
        ...current[existingIdx],
        quantite: existingQty + addQty,
      });
      remove(index);
      toast.info(`Quantités fusionnées sur la ligne existante (${p.reference})`);
      return;
    }
    update(index, {
      produit_id: p.produit_id,
      reference_produit: p.reference,
      designation: p.titre,
      quantite: form.getValues(`lignes.${index}.quantite`) as any,
      prix_unitaire: p.prix_vente,
      remise_pct: form.getValues(`lignes.${index}.remise_pct`) || 0,
      stock_produit: typeof p.stock === "number" ? p.stock : null,
      cover_path: p.cover_path || null,
      cover_thumb_path: p.cover_thumb_path || null,
    });
  };

  // Client sélectionné : plafond, solde, conditions
  const { data: selectedClient } = useQuery({
    queryKey: ["client-info", clientId],
    queryFn: () => getClient(clientId),
    enabled: !!clientId,
    staleTime: 60_000,
  });

  // Stock en temps réel par ligne (dépôt courant ou stock global du produit)
  const depotId = form.watch("depot_id") || "";
  const stockQueries = useQueries({
    queries: lignesWatch.map((l) => ({
      queryKey: ["ligne-stock", l.produit_id, depotId],
      queryFn: async () => {
        if (!l.produit_id) return null;
        if (depotId) return getStockProduitDepot(l.produit_id, depotId);
        const p = await getProduit(l.produit_id);
        return p?.stock ?? 0;
      },
      enabled: !!l.produit_id,
      staleTime: 15_000,
    })),
  });

  const overshootIndexes = useMemo(() => {
    const out: number[] = [];
    lignesWatch.forEach((l, i) => {
      const s = stockQueries[i]?.data;
      if (typeof s === "number" && (l.quantite || 0) > s) out.push(i);
    });
    return out;
  }, [lignesWatch, stockQueries]);

  // Sync du stock affiché sur chaque ligne dès qu'un dépôt (ou le produit)
  // change : on écrit la valeur retournée par la requête temps réel dans
  // le champ `stock_produit`, ce qui met à jour tableaux/cartes et le
  // dépassement même quand la requête est en cache.
  useEffect(() => {
    stockQueries.forEach((q, i) => {
      if (typeof q.data !== "number") return;
      const current = form.getValues(`lignes.${i}.stock_produit`);
      if (current !== q.data) {
        form.setValue(`lignes.${i}.stock_produit`, q.data, {
          shouldDirty: false,
          shouldTouch: false,
          shouldValidate: false,
        });
      }
    });
  }, [depotId, stockQueries, form]);

  const hasOvershoot = overshootIndexes.length > 0;
  const totalArticles = fields.length;
  const totalQuantite = lignesWatch.reduce((s, l) => s + (l.quantite || 0), 0);

  return (
    <form onSubmit={onSubmit} className="space-y-6 pb-32 2xl:pb-6">
      {mode === "create" && draft.pendingDraft ? (
        <DraftRestoreBanner
          label="commande"
          updatedAt={draft.pendingDraft.updatedAt}
          onDiscard={() => void draft.discard()}
          onRestore={() => {
            const v = draft.restore();
            if (!v) return;
            form.reset({ ...form.getValues(), ...v } as CommandeFormValues);
          }}
        />
      ) : null}
      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_320px]">

        <div className="space-y-6 min-w-0">
          {/* 1. Client */}
          <section className="relative overflow-hidden rounded-md border bg-card p-4 pl-5 sm:p-5 sm:pl-6 space-y-4">
            <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: "#3B82F6" }} />
            <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-white shadow-sm" style={{ backgroundColor: "#3B82F6" }}>
                <User className="h-4 w-4" />
              </span>
              1. Client
            </h2>
            <div>
              <Label className="mb-1 block text-xs sm:text-sm">
                Rechercher (Client, CMD, FAC, PRO, BL, Tél...)
              </Label>
              <ClientSearchSelect
                value={clientId}
                onChange={(id, client) => {
                  form.setValue("client_id", id ?? "", { shouldValidate: true });
                  applyClientToForm(client);
                }}
              />
            </div>
            {form.formState.errors.client_id && (
              <p className="text-xs text-destructive">{form.formState.errors.client_id.message}</p>
            )}

            {selectedClient && (
              <div className="rounded-md bg-muted/50 p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <InfoCell label="Type" value={selectedClient.type_client} />
                <InfoCell label="Commercial" value={selectedClient.representant ?? "—"} />
                <InfoCell
                  label="Plafond crédit"
                  value={formatFCFA(selectedClient.plafond_credit ?? 0)}
                />
                <InfoCell
                  label="Solde"
                  value={formatFCFA(selectedClient.solde ?? 0)}
                  emphasis={(selectedClient.solde ?? 0) > (selectedClient.plafond_credit ?? 0)}
                />
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Client (Établissement)</Label>
                <Input readOnly className="bg-muted font-semibold" {...form.register("etablissement")} />
              </div>
              <div>
                <Label className="text-xs">Représentant</Label>
                <Input {...form.register("representant_nom")} />
              </div>
              <div>
                <Label className="text-xs">Téléphone</Label>
                <Input {...form.register("telephone")} />
              </div>
              <div>
                <Label className="text-xs">Ville</Label>
                <Input {...form.register("ville")} />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Adresse</Label>
                <Input {...form.register("adresse")} />
              </div>
            </div>
          </section>

          {/* 2. Infos commande */}
          <section className="relative overflow-hidden rounded-md border bg-card p-4 pl-5 sm:p-5 sm:pl-6 space-y-4">
            <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: "#8B5CF6" }} />
            <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-white shadow-sm" style={{ backgroundColor: "#8B5CF6" }}>
                <Info className="h-4 w-4" />
              </span>
              2. Informations Générales
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <Label htmlFor="date_commande" className="text-xs">
                  Date *
                </Label>
                <Input id="date_commande" type="date" {...form.register("date_commande")} />
              </div>
              <div>
                <DepotSortieField
                  value={form.watch("depot_id") ?? ""}
                  onChange={(id, motif) => {
                    form.setValue("depot_id", id, { shouldValidate: true });
                    form.setValue("depot_override_motif", motif ?? null);
                  }}
                  label="Dépôt de sortie *"
                />
              </div>
            </div>
          </section>

          {/* 3. Produits */}
          <LignesSection
            form={form}
            fields={fields}
            lignesWatch={lignesWatch}
            stockQueries={stockQueries}
            overshootIndexes={overshootIndexes}
            totalArticles={totalArticles}
            totalQuantite={totalQuantite}
            addLigne={addLigne}
            remove={remove}
            onProduitChange={onProduitChange}
            remiseEnLigneDisabled={hasRemiseGlobale}
          />

          {/* 4. Remise globale */}
          <section className="relative overflow-hidden rounded-md border bg-card p-4 pl-5 sm:p-5 sm:pl-6 space-y-3">
            <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: "#10B981" }} />
            <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-white shadow-sm" style={{ backgroundColor: "#10B981" }}>
                <Percent className="h-4 w-4" />
              </span>
              4. Remise globale
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="remise_globale_pct" className="text-xs">
                  Remise globale (%)
                </Label>
                <NumberField
                  control={form.control}
                  name="remise_globale_pct"
                  step="0.01"
                  min={0}
                  max={100}
                  disabled={hasRemiseEnLigne}
                />
                {form.formState.errors.remise_globale_pct && (
                  <p className="text-[10px] text-destructive mt-0.5">{form.formState.errors.remise_globale_pct.message}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  S'applique sur le total HT après remises de ligne.
                  <br />
                  <span className={`text-[10px] font-semibold italic ${hasRemiseEnLigne ? "text-destructive" : "text-amber-600"}`}>
                    {hasRemiseEnLigne 
                      ? "Attention : Remise globale bloquée car des remises en ligne sont utilisées. Supprimez-les pour l'activer." 
                      : "Note : Impossible d'utiliser une remise globale si des remises en ligne sont déjà saisies."}
                  </span>
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Résumé : colonne sur desktop, barre fixe en bas sur mobile */}
        <aside className="hidden 2xl:block">
          <div className="sticky top-6 space-y-4">
            <SummaryCard
              totaux={totaux}
              tauxTva={tauxTva}
              remiseGlobalePct={remiseGlobalePct || 0}
              totalArticles={totalArticles}
              totalQuantite={totalQuantite}
            />
            <div className="flex flex-col gap-2">
              <Button
                type="submit"
                disabled={mutation.isPending || hasOvershoot}
                className="w-full"
              >
                {mutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {mutation.isPending
                  ? "Enregistrement…"
                  : mode === "edit"
                    ? "Mettre à jour"
                    : "Enregistrer"}
              </Button>
              <Button type="button" variant="outline" asChild className="w-full">
                <Link to="/commandes">Annuler</Link>
              </Button>
            </div>
          </div>
        </aside>
      </div>

      {/* Barre récap mobile / tablette */}
      <div className="2xl:hidden fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] md:bottom-0 z-40 border-t bg-background/95 backdrop-blur p-3 space-y-2 shadow-lg">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {totalArticles} art. · Qté {totalQuantite}
          </span>
          <span className="text-muted-foreground">HT {formatFCFA(totaux.htApresRG)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase text-muted-foreground">Net à payer</div>
            <div className="truncate text-lg font-bold">{formatFCFA(totaux.ttc)}</div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button type="button" variant="outline" size="sm" asChild>
              <Link to="/commandes">Annuler</Link>
            </Button>
            <Button type="submit" size="sm" disabled={mutation.isPending || hasOvershoot}>
              {mutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              {mutation.isPending ? "Envoi…" : mode === "edit" ? "MAJ" : "Enregistrer"}
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la création de la commande</AlertDialogTitle>
            <AlertDialogDescription>
              Vérifiez le récapitulatif avant enregistrement. Cette action créera la
              commande dans le système.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pendingValues && (
            <div className="space-y-3 text-sm max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-2">
                <InfoCell label="Date" value={formatDate(pendingValues.date_commande)} />
                <InfoCell
                  label="Client"
                  value={selectedClient?.nom ?? pendingValues.etablissement ?? "—"}
                />
                <InfoCell label="Représentant" value={pendingValues.representant_nom || "—"} />
                <InfoCell label="Téléphone" value={pendingValues.telephone || "—"} />
                <InfoCell label="Ville" value={pendingValues.ville || "—"} />
                <InfoCell label="Adresse" value={pendingValues.adresse || "—"} />
              </div>
              <div className="rounded-md border">
                <table className="w-full text-xs table-zebra-orange table-print-borders">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-left p-2">Produit</th>
                      <th className="text-right p-2">Qté</th>
                      <th className="text-right p-2">PU</th>
                      <th className="text-right p-2">Rem.</th>
                      <th className="text-right p-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingValues.lignes.map((l, i) => {
                      const c = computeLigne(l.quantite || 0, l.prix_unitaire || 0, l.remise_pct || 0);
                      return (
                        <tr key={i} className="border-t">
                          <td className="p-2">{l.designation}</td>
                          <td className="p-2 text-right">{l.quantite}</td>
                          <td className="p-2 text-right">{formatFCFA(l.prix_unitaire)}</td>
                          <td className="p-2 text-right">{l.remise_pct}%</td>
                          <td className="p-2 text-right">{formatFCFA(c.totalLigne)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="grid grid-cols-2 gap-2 rounded-md bg-muted/50 p-3">
                <InfoCell label="Articles" value={String(totalArticles)} />
                <InfoCell label="Quantité totale" value={String(totalQuantite)} />
                <InfoCell label="Total HT (net)" value={formatFCFA(totaux.htApresRG)} />
                <InfoCell
                  label={`TVA (${tauxTva}%)`}
                  value={formatFCFA(totaux.tva)}
                />
                <InfoCell
                  label={`Remise globale (${pendingValues.remise_globale_pct}%)`}
                  value={`- ${formatFCFA(totaux.remiseGlobaleMontant)}`}
                />
                <InfoCell label="Net à payer" value={formatFCFA(totaux.ttc)} emphasis />
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Modifier la saisie</AlertDialogCancel>
            <Button 
              variant="default"
              onClick={() => {
                if (canValiderCommande) {
                  setConfirmOpen(false);
                  setImmediateConfirmOpen(true);
                } else {
                  confirmSubmit(false);
                }
              }}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Enregistrement…" : "Suivant"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      <AlertDialog open={!!recap} onOpenChange={(o) => !o && setRecap(null)}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Commande enregistrée avec succès</AlertDialogTitle>
            <AlertDialogDescription>
              {recap?.autoValidated
                ? "La commande a été validée automatiquement. La facture et le bon de livraison ont été générés."
                : "La commande a été enregistrée et est en attente de validation."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {recap && (
            <div className="space-y-2 text-sm">
              <div className="rounded-md border p-3 space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Commande</span>
                  <span className="font-mono font-semibold">{recap.commandeRef}</span>
                </div>
                {recap.factureRef && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Facture</span>
                    <span className="font-mono font-semibold">{recap.factureRef}</span>
                  </div>
                )}
                {recap.blRef && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bon de livraison</span>
                    <span className="font-mono font-semibold">{recap.blRef}</span>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button asChild variant="outline" size="sm">
                  <Link to="/commandes/$commandeId" params={{ commandeId: recap.commandeId }}>
                    Voir la commande
                  </Link>
                </Button>
                {recap.factureId && (
                  <Button asChild variant="outline" size="sm">
                    <Link to="/factures">Voir les factures</Link>
                  </Button>
                )}
                {recap.blId && (
                  <Button asChild variant="outline" size="sm">
                    <Link to="/bons-livraison">Voir les BL</Link>
                  </Button>
                )}
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => {
                setRecap(null);
                navigate({ to: "/commandes" });
              }}
            >
              Fermer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={immediateConfirmOpen} onOpenChange={setImmediateConfirmOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Action de validation</AlertDialogTitle>
            <AlertDialogDescription>
              La commande est prête. Vous disposez des droits de validation. Que souhaitez-vous faire ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-3 py-4">
            <Button
              variant="outline"
              className="justify-start h-auto py-3 px-4 flex-col items-start gap-1"
              onClick={() => {
                setImmediateConfirmOpen(false);
                confirmSubmit(false);
              }}
            >
              <span className="font-semibold text-base text-amber-600">Option 2 : Mettre en attente</span>
              <span className="text-xs text-muted-foreground text-left">
                Crée uniquement la proforma et le bon de commande. Le statut sera "En attente".
              </span>
            </Button>
            
            <Button
              className="justify-start h-auto py-3 px-4 flex-col items-start gap-1"
              onClick={() => {
                setImmediateConfirmOpen(false);
                setFraisTransportOpen(true);
              }}
            >
              <span className="font-semibold text-base">Option 1 : Valider la facture</span>
              <span className="text-xs text-primary-foreground/80 text-left">
                Crée la facture définitive, le BL, et exécute toutes les opérations (stock, compta).
              </span>
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmOpen(true)}>Retour au récapitulatif</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <FraisTransportDialog
        open={fraisTransportOpen}
        pending={mutation.isPending}
        onOpenChange={setFraisTransportOpen}
        onConfirm={(frais) => {
          if (mutation.isPending) return;
          setFraisTransportOpen(false);
          confirmSubmit(true, frais);
        }}
      />
    </form>
  );
}
