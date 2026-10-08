import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Gift, Save } from "lucide-react";

import { Button } from "@/components/ui/button";

import { type Client } from "@/lib/clients-api";
import type { Produit } from "@/lib/produits-api";
import { creerSpecimen } from "@/lib/specimens-api";
import { invalidateSpecimen } from "@/lib/cache-invalidation";
import { usePermissions } from "@/hooks/use-permissions";
import { listDepots } from "@/lib/depots-api";
import { specimenFormSchema, type SpecimenFormValues } from "@/lib/specimens-form";
import { InfosGeneralesSection } from "@/components/specimens/nouveau/InfosGeneralesSection";
import { BeneficiaireSection } from "@/components/specimens/nouveau/BeneficiaireSection";
import { LignesProduitsSection } from "@/components/specimens/nouveau/LignesProduitsSection";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { friendlyError } from "@/lib/friendly-error";

export const Route = createFileRoute("/_authenticated/specimens/nouveau")({
  component: SpecimenNouveauPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function SpecimenNouveauPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { has, isLoading: permLoading } = usePermissions();
  const canManage = has("specimens.creer");

  const form = useForm<SpecimenFormValues>({
    resolver: zodResolver(specimenFormSchema),
    defaultValues: {
      date_envoi: new Date().toISOString().slice(0, 10),
      motif: "",
      donneur_nom: "",
      observations: "",
      depot_id: "",
      client_id: "",
      etablissement: "",
      representant_nom: "",
      telephone: "",
      ville: "",
      adresse: "",
      lignes: [],
    },
  });

  const fa = useFieldArray({ control: form.control, name: "lignes" });

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
    mutationFn: (values: SpecimenFormValues) =>
      creerSpecimen({
        date_envoi: values.date_envoi,
        client_id: values.client_id,
        etablissement: values.etablissement || null,
        representant_nom: values.representant_nom || null,
        telephone: values.telephone || null,
        ville: values.ville || null,
        adresse: values.adresse || null,
        donneur_nom: values.donneur_nom,
        motif: values.motif || null,
        observations: values.observations || null,
        depot_id: values.depot_id || null,
        lignes: values.lignes.map((l) => ({
          produit_id: l.produit_id,
          reference_produit: l.reference_produit ?? null,
          designation: l.designation,
          quantite: l.quantite,
        })),
      }),
    onSuccess: () => {
      toast.success("Spécimen enregistré avec succès");
      invalidateSpecimen(qc);
      navigate({ to: "/specimens" });
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
        stock_dispo: 0,
        quantite: form.getValues(`lignes.${index}.quantite`) || 1,
      });
      return;
    }
    fa.update(index, {
      produit_id: p.produit_id,
      reference_produit: p.reference,
      designation: p.titre,
      stock_dispo: p.stock,
      quantite: Math.min(form.getValues(`lignes.${index}.quantite`) || 1, p.stock || 1),
    });
  };

  if (!permLoading && !canManage) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">
          Vous n'avez pas l'autorisation d'enregistrer un spécimen.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/specimens">Retour à la liste</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button aria-label="Retour" asChild variant="ghost" size="icon">
            <Link to="/specimens">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <Gift className="h-6 w-6 text-primary" />
          <div>
            <h1 className="ds-page-title">Nouveau Spécimen</h1>
            <p className="text-sm text-muted-foreground">
              Remise gratuite d'ouvrages à un établissement
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <InfosGeneralesSection form={form} depots={depots} />
        <BeneficiaireSection form={form} applyClient={applyClient} />
        <LignesProduitsSection form={form} fa={fa} onProduitChange={onProduitChange} />

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" asChild>
            <Link to="/specimens">Annuler</Link>
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {mutation.isPending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </form>
    </div>
  );
}
