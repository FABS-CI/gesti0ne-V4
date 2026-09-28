import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Loader2, RotateCcw, Save, ReceiptText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { type Client } from "@/lib/clients-api";
import { type Produit } from "@/lib/produits-api";
import { creerEtValiderRetour as creerRetourDemande } from "@/lib/retours-api";
import { invalidateRetour } from "@/lib/cache-invalidation";
import { usePermissions } from "@/hooks/use-permissions";
import { listDepots } from "@/lib/depots-api";
import { retourFormSchema, type RetourFormValues } from "@/lib/retours-form";
import { ClientSection } from "@/components/retours/nouveau/ClientSection";
import { DocumentSection } from "@/components/retours/nouveau/DocumentSection";
import { InfosSection } from "@/components/retours/nouveau/InfosSection";
import { LignesSection } from "@/components/retours/nouveau/LignesSection";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { useServerDraft } from "@/hooks/use-server-draft";
import { DraftRestoreBanner } from "@/components/ui/draft-restore-banner";
import { friendlyError } from "@/lib/friendly-error";

export const Route = createFileRoute("/_authenticated/retours/nouveau")({
  validateSearch: (search: Record<string, unknown>) => ({
    clientId: (search.clientId as string) || undefined,
    type_retour: (search.type_retour as "physique" | "avoir") || undefined,
  }),
  component: RetourNouveauPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function RetourNouveauPage() {
  const navigate = useNavigate();
  const search = Route.useSearch() as { clientId?: string; type_retour?: "physique" | "avoir" };
  const qc = useQueryClient();
  const { has, isLoading: permLoading } = usePermissions();
  const canManage = has("retours.creer");

  const form = useForm<RetourFormValues>({
    resolver: zodResolver(retourFormSchema),
    defaultValues: {
      date_retour: new Date().toISOString().slice(0, 10),
      client_id: search.clientId || "",
      facture_id: "",
      livraison_id: "",
      type_retour: search.type_retour || "physique",
      etablissement: "",
      representant_nom: "",
      telephone: "",
      ville: "",
      adresse: "",
      observations: "",
      depot_id: "",
      niveau_urgence: "normal",
      motif: "",
      lignes: [],
    },
  });

  const { data: clientInitial } = useQuery({
    queryKey: ["client", search.clientId],
    queryFn: async () => {
      if (!search.clientId) return null;
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("client_id", search.clientId)
        .single();
      if (error) throw error;
      return data as Client;
    },
    enabled: !!search.clientId,
  });

  useEffect(() => {
    if (clientInitial) {
      applyClient(clientInitial);
    }
  }, [clientInitial]);

  const fa = useFieldArray({ control: form.control, name: "lignes" });

  // Brouillon serveur (reprise de saisie)
  const draftWatch = useWatch({ control: form.control }) as Partial<RetourFormValues>;
  const draft = useServerDraft<Partial<RetourFormValues>>({
    docType: "retour",
    value: draftWatch,
    isEmpty: (v) => !v.client_id && !(v.lignes ?? []).some((l) => l?.produit_id || l?.designation),
  });

  const { data: depots = [] } = useQuery({ queryKey: ["depots"], queryFn: listDepots });


  const applyClient = (c: Client | null) => {
    if (!c) return;
    form.setValue("etablissement", c.nom ?? "");
    form.setValue("representant_nom", c.representant ?? "");
    form.setValue("telephone", c.telephone ?? "");
    form.setValue("ville", c.ville ?? "");
    form.setValue("adresse", c.adresse ?? "");
  };

  const mutation = useMutation({
    mutationFn: (values: RetourFormValues) =>
      creerRetourDemande({
        date_retour: values.date_retour,
        client_id: values.client_id,
        type_retour: values.type_retour,
        facture_id: values.facture_id || null,
        livraison_id: values.livraison_id || null,
        etablissement: values.etablissement || null,
        representant_nom: values.representant_nom || null,
        telephone: values.telephone || null,
        ville: values.ville || null,
        adresse: values.adresse || null,
        observations: values.observations || null,
        depot_id: values.type_retour === "avoir" ? null : values.depot_id || null,
        niveau_urgence: values.niveau_urgence ?? "normal",
        motif: values.motif || null,
        lignes: values.lignes.map((l) => ({
          produit_id: l.produit_id,
          reference_produit: l.reference_produit ?? null,
          designation: l.designation,
          quantite: l.quantite,
          motif: l.motif ?? null,
        })),
      }),
    onSuccess: (_data, values) => {
      void draft.markConverted();
      toast.success("Retour créé et validé avec succès.");
      invalidateRetour(qc, { clientId: values.client_id });
      navigate({ to: "/retours" });
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  const onSubmit = form.handleSubmit(
    (values) => mutation.mutate(values),
    () => toast.error("Veuillez corriger les erreurs du formulaire"),
  );

  const onProduitChange = (index: number, p: Produit | null) => {
    if (!p) {
      fa.update(index, {
        produit_id: "",
        reference_produit: "",
        designation: "",
        quantite: form.getValues(`lignes.${index}.quantite`) || 1,
        prix_unitaire: 0,
        remise_pct: 0,
        motif: form.getValues(`lignes.${index}.motif`) || "",
      });
      return;
    }
    fa.update(index, {
      produit_id: p.produit_id,
      reference_produit: p.reference,
      designation: p.titre,
      quantite: form.getValues(`lignes.${index}.quantite`) || 1,
      prix_unitaire: p.prix_vente || 0,
      remise_pct: 0,
      motif: form.getValues(`lignes.${index}.motif`) || "",
    });
  };

  if (!permLoading && !canManage) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">
          Vous n'avez pas l'autorisation d'enregistrer un retour.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/retours">Retour à la liste</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link to="/retours">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          {form.watch("type_retour") === "avoir" ? (
            <ReceiptText className="h-6 w-6 text-purple-600" />
          ) : (
            <RotateCcw className="h-6 w-6 text-primary" />
          )}
          <div>
            <h1 className="text-2xl font-bold">
              {form.watch("type_retour") === "avoir" ? "Nouvel Avoir" : "Nouveau Retour"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {form.watch("type_retour") === "avoir"
                ? "Génération d'un avoir financier pour le client"
                : "Enregistrement d'un retour produits client"}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        {draft.pendingDraft ? (
          <DraftRestoreBanner
            label="retour"
            updatedAt={draft.pendingDraft.updatedAt}
            onDiscard={() => void draft.discard()}
            onRestore={() => {
              const v = draft.restore();
              if (!v) return;
              form.reset({ ...form.getValues(), ...v } as RetourFormValues);
            }}
          />
        ) : null}
        <ClientSection form={form} applyClient={applyClient} />
        <DocumentSection form={form} fa={fa} />
        <InfosSection form={form} depots={depots} />
        <LignesSection form={form} fa={fa} onProduitChange={onProduitChange} />

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" asChild>
            <Link to="/retours">Annuler</Link>
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {mutation.isPending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </form>
    </div>
  );
}
