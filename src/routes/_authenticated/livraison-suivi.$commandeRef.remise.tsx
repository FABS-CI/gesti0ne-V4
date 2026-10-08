import { formatDate } from "@/lib/format";
import { COMMANDE_REF_SEARCH_DEFAULTS } from "@/lib/route-schemas";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, PackageCheck, Truck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  getSuiviByCommandeRef,
  avancerEtape,
  nextEtape,
  STATUT_LABEL,
  STATUT_COLOR,
} from "@/lib/livraison-suivi-api";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { friendlyError } from "@/lib/friendly-error";

export type ValidateButtonState = {
  isPending: boolean;
  canValidate: boolean;
  isError: boolean;
  isSuccess: boolean;
  hasData: boolean;
};

/**
 * Le bouton « Valider l'étape » doit rester désactivé tant que :
 * - la mutation est en cours,
 * - les infos requises ne sont pas préchargées,
 * - la dernière tentative a échoué,
 * - la RPC a renvoyé un succès sans mise à jour (0 rows) — l'utilisateur doit recharger.
 */
export function isValidateDisabled(s: ValidateButtonState): boolean {
  return s.isPending || !s.canValidate || s.isError || (s.isSuccess && !s.hasData);
}

/**
 * Adresse à afficher pour la remise. Retombe sur la ville si `adresse` est
 * absente, puis sur un tiret pour éviter tout crash / champ vide brut.
 */
export function formatAdresseLivraison(
  cmd: { adresse?: string | null; ville?: string | null } | null | undefined,
): string {
  const adresse = cmd?.adresse?.trim();
  if (adresse) return adresse;
  const ville = cmd?.ville?.trim();
  if (ville) return ville;
  return "—";
}

export const Route = createFileRoute("/_authenticated/livraison-suivi/$commandeRef/remise")({
  component: RemisePage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function RemisePage() {
  const { commandeRef } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: suivi, isLoading } = useQuery({
    queryKey: ["livsuivi", "detail", commandeRef],
    queryFn: () => getSuiviByCommandeRef(commandeRef),
  });

  const mut = useMutation({
    mutationFn: () => {
      if (!suivi) throw new Error("Suivi introuvable");
      const etape = nextEtape(suivi.type_livraison, suivi.statut);
      if (etape !== "remise_livreur" && etape !== "remise_transporteur") {
        throw new Error("L'étape de remise n'est plus applicable");
      }
      // Toutes les infos sont déjà connues → pas de meta à saisir.
      // On repasse les valeurs déjà présentes pour tracer la remise.
      const meta: Record<string, string> = {};
      const livreur = suivi.livreur_nom ?? colis?.livreur_nom ?? colis?.transporteur ?? "";
      const vehicule = suivi.vehicule ?? colis?.vehicule ?? "";
      if (livreur) meta.livreur_nom = livreur;
      if (vehicule) meta.vehicule = vehicule;
      return avancerEtape(suivi.id, etape, meta, undefined);
    },
    onSuccess: (data) => {
      // Cas « 0 mise à jour » : la RPC a renvoyé null / rien mis à jour.
      if (!data) {
        toast.error(
          "Aucune mise à jour effectuée. Le statut a peut-être déjà changé — rechargez la page.",
        );
        return;
      }
      toast.success("Étape validée");
      qc.invalidateQueries({ queryKey: ["livsuivi"] });
      navigate({ to: "/livraison-suivi/$commandeRef", params: { commandeRef }, search: COMMANDE_REF_SEARCH_DEFAULTS });
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Chargement…</div>;
  }
  if (!suivi) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Aucun suivi pour cette commande.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/livraison-suivi">Retour</Link>
        </Button>
      </div>
    );
  }

  const colis = suivi.colis ?? null;
  const cmd = suivi.commande ?? null;
  const etape = nextEtape(suivi.type_livraison, suivi.statut);
  const isTransporteur = etape === "remise_transporteur";
  const isLivreur = etape === "remise_livreur";

  // Données minimales requises avant d'autoriser la validation.
  const livreurValue = suivi.livreur_nom ?? colis?.livreur_nom ?? colis?.transporteur ?? "";
  const missing: string[] = [];
  if (!cmd) missing.push("commande");
  if (!colis) missing.push("colis");
  if (!livreurValue) missing.push(isTransporteur ? "transporteur" : "livreur");
  const canValidate = missing.length === 0 && (isTransporteur || isLivreur);

  // Si l'étape courante n'est pas une remise, on renvoie vers le détail.
  if (!isTransporteur && !isLivreur) {
    return (
      <div className="p-6 space-y-4">
        <p className="text-muted-foreground">
          La prochaine étape n'est pas une remise ({etape ? STATUT_LABEL[etape] : "aucune"}). Cette
          page est réservée aux étapes « Remise au livreur » et « Remise au transporteur ».
        </p>
        <Button asChild variant="outline">
          <Link to="/livraison-suivi/$commandeRef" params={{ commandeRef }} search={COMMANDE_REF_SEARCH_DEFAULTS}>
            Retour au suivi
          </Link>
        </Button>
      </div>
    );
  }

  const Icon = isTransporteur ? Truck : PackageCheck;
  const title = isTransporteur ? "Remise au transporteur" : "Remise au livreur";

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Button aria-label="Retour" asChild variant="ghost" size="icon">
          <Link to="/livraison-suivi/$commandeRef" params={{ commandeRef }} search={COMMANDE_REF_SEARCH_DEFAULTS}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Icon className="h-6 w-6 text-primary" />
          <div>
            <h1 className="ds-page-title">{title}</h1>
            <p className="text-sm text-muted-foreground">
              Commande {cmd?.reference ?? commandeRef} — vérifiez puis validez l'étape.
            </p>
          </div>
        </div>
        <div className="ml-auto">
          <Badge style={{ backgroundColor: STATUT_COLOR[suivi.statut], color: "white" }}>
            Actuel : {STATUT_LABEL[suivi.statut]}
          </Badge>
        </div>
      </div>

      <Section title="Informations de la commande">
        <InfoRow label="N° Commande" value={cmd?.reference} />
        <InfoRow label="Client" value={cmd?.client_nom} />
        <InfoRow label="Destinataire" value={colis?.destinataire ?? cmd?.client_nom} />
        <InfoRow label="Adresse de livraison" value={formatAdresseLivraison(cmd)} />
        <InfoRow label="Téléphone" value={cmd?.telephone} />
        <InfoRow
          label="Date"
          value={
            colis?.bl_date_livraison
              ? formatDate(colis.bl_date_livraison)
              : colis?.date_envoi
                ? formatDate(colis.date_envoi)
                : null
          }
        />
      </Section>

      <Section title="Informations des colis">
        <InfoRow label="Nombre de colis" value={colis ? String(colis.nb_colis) : null} />
        <InfoRow label="Référence colis" value={colis?.reference} />
        <InfoRow
          label="Carton"
          value={
            colis?.numero_carton && colis?.nb_cartons
              ? `${colis.numero_carton} / ${colis.nb_cartons}`
              : colis?.numero_carton
                ? String(colis.numero_carton)
                : null
          }
        />
        <InfoRow label="Poids" value={colis?.poids != null ? `${colis.poids} kg` : null} />
        <InfoRow label="Contenu / Observations" value={colis?.contenu} />
        <InfoRow label="N° Bon de livraison" value={colis?.bl_reference} />
      </Section>

      <Section title={isTransporteur ? "Informations du transporteur" : "Informations du livreur"}>
        {isTransporteur ? (
          <>
            <InfoRow label="Transporteur" value={colis?.transporteur} />
            <InfoRow label="Agent / Contact" value={suivi.livreur_nom ?? colis?.livreur_nom} />
            <InfoRow label="Téléphone" value={colis?.livreur_telephone} />
            <InfoRow label="Véhicule" value={suivi.vehicule ?? colis?.vehicule} />
            <InfoRow label="Gare de départ" value={colis?.gare_depart} />
            <InfoRow label="Chef de gare" value={colis?.gare_responsable} />
            <InfoRow label="Tél. chef de gare" value={colis?.gare_telephone} />
            <InfoRow label="Ville de destination" value={colis?.ville_destination} />
          </>
        ) : (
          <>
            <InfoRow label="Nom du livreur" value={suivi.livreur_nom ?? colis?.livreur_nom} />
            <InfoRow label="Téléphone" value={colis?.livreur_telephone} />
            <InfoRow label="Véhicule / Immatriculation" value={suivi.vehicule ?? colis?.vehicule} />
            <InfoRow label="Dépôt de départ" value={colis?.depot_nom} />
            <InfoRow label="Commune" value={colis?.commune} />
            <InfoRow label="Quartier" value={colis?.quartier} />
          </>
        )}
      </Section>

      <Separator />

      {missing.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Informations manquantes</AlertTitle>
          <AlertDescription>
            Impossible de valider l'étape tant que les données suivantes ne sont pas préchargées :{" "}
            {missing.join(", ")}.
          </AlertDescription>
        </Alert>
      )}

      {mut.isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Échec de la validation</AlertTitle>
          <AlertDescription>
            {(mut.error as Error)?.message ?? "Une erreur inattendue s'est produite."}
          </AlertDescription>
        </Alert>
      )}

      {mut.isSuccess && !mut.data && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Aucune mise à jour</AlertTitle>
          <AlertDescription>
            L'API n'a modifié aucune ligne. Le statut a peut-être déjà été avancé par un autre
            utilisateur. Rechargez la page pour voir l'état actuel.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="outline">
          <Link to="/livraison-suivi/$commandeRef" params={{ commandeRef }} search={COMMANDE_REF_SEARCH_DEFAULTS}>
            Retour
          </Link>
        </Button>
        <Button
          onClick={() => mut.mutate()}
          disabled={isValidateDisabled({
            isPending: mut.isPending,
            canValidate,
            isError: mut.isError,
            isSuccess: mut.isSuccess,
            hasData: Boolean(mut.data),
          })}
          size="lg"
        >
          {mut.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4 mr-2" />
          )}
          {mut.isPending ? "Validation en cours…" : "Valider l'étape"}
        </Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-card p-5">
      <h2 className="font-semibold mb-3">{title}</h2>
      <div className="grid gap-2 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-2 border-b border-dashed border-border/40 py-1.5 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{value || "—"}</span>
    </div>
  );
}
