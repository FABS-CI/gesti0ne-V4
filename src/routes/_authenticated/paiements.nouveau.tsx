import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { AlertCircle, ArrowLeft, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/use-permissions";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientSearchSelect } from "@/components/search/ClientSearchSelect";
import {
  FacturesImpayeesCard,
  type FactureImpayeeRow,
} from "@/components/paiements/nouveau/FacturesImpayeesCard";
import { PaiementFormCard, type FormState } from "@/components/paiements/nouveau/PaiementFormCard";
import { RecapCard } from "@/components/paiements/nouveau/RecapCard";
import { formatFCFA, formatDate } from "@/lib/format";
import { computeRecap, type RecapLine } from "@/lib/paiement-recap";

import { newIdempotencyKey } from "@/lib/idempotency";
import {
  enregistrerPaiementMulti,
  listFacturesImpayeesClient,
  type AllocationInput,
  type EnregistrerPaiementMultiInput,
} from "@/lib/paiements-api";
import { getClient } from "@/lib/clients-api";
import { paiementSchema } from "@/lib/paiement-recap";
import { invalidatePaiement } from "@/lib/cache-invalidation";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { friendlyError } from "@/lib/friendly-error";

const searchSchema = z.object({
  clientId: fallback(z.string().optional(), undefined).default(undefined),
});

export const Route = createFileRoute("/_authenticated/paiements/nouveau")({
  validateSearch: zodValidator(searchSchema),
  component: NouveauPaiementPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function NouveauPaiementPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { clientId: presetClientId } = Route.useSearch();
  const { has } = usePermissions();
  const canValider = has("paiements.valider");

  const [clientId, setClientId] = useState<string | null>(presetClientId ?? null);
  const [clientNom, setClientNom] = useState<string>("");
  const [clientError, setClientError] = useState<string | null>(null);
  /** facture_id -> montant affecté */
  const [allocs, setAllocs] = useState<Record<string, number>>({});
  const [mode, setMode] = useState<"draft" | "confirm">("draft");
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (presetClientId && !clientNom) {
      getClient(presetClientId)
        .then((c) => {
          if (c) setClientNom(c.nom);
          else setClientError("Client introuvable pour cet identifiant.");
        })
        .catch(() => setClientError("Impossible de charger le client."));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetClientId]);

  const [form, setForm] = useState<FormState>(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const autoRef = `PAY-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    return {
      date_paiement: now.toISOString().slice(0, 10),
      montant: 0,
      mode_paiement: "especes",
      reference_paiement: autoRef,
      banque: "",
      num_transaction: "",
      observations: "",
    };
  });

  const { data: factures = [], isLoading: facLoading } = useQuery({
    queryKey: ["factures-impayees", clientId],
    queryFn: () => (clientId ? listFacturesImpayeesClient(clientId) : Promise.resolve([])),
    enabled: !!clientId,
  });

  const totalAffecte = useMemo(
    () => Object.values(allocs).reduce((s, m) => s + (Number(m) || 0), 0),
    [allocs],
  );

  const syncMontant = (next: Record<string, number>) => {
    const total = Object.values(next).reduce((s, m) => s + (Number(m) || 0), 0);
    setForm((s) => ({ ...s, montant: total }));
  };

  const toggleFacture = (f: FactureImpayeeRow, checked: boolean) => {
    setAllocs((prev) => {
      const next = { ...prev };
      if (checked) next[f.facture_id] = Number(f.solde);
      else delete next[f.facture_id];
      syncMontant(next);
      return next;
    });
  };

  const changeMontant = (factureId: string, montant: number) => {
    setAllocs((prev) => {
      const next = { ...prev, [factureId]: montant };
      syncMontant(next);
      return next;
    });
  };

  // Une seule facture impayée : présélection automatique
  useEffect(() => {
    if (factures.length === 1 && Object.keys(allocs).length === 0) {
      const f = factures[0];
      const next = { [f.facture_id]: Number(f.solde) };
      setAllocs(next);
      setForm((s) => ({ ...s, montant: Number(f.solde) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factures]);

  // Clé d'idempotence stable pour toute la saisie (anti-doublon)
  const idempotencyKey = useMemo(() => newIdempotencyKey("pai"), []);

  const mutation = useMutation({
    mutationFn: (payload: EnregistrerPaiementMultiInput) =>
      enregistrerPaiementMulti({ ...payload, idempotency_key: idempotencyKey }),
    onSuccess: () => {
      toast.success(
        canValider
          ? "Paiement enregistré et validé"
          : "Paiement enregistré, en attente de validation comptable",
      );
      invalidatePaiement(queryClient, { clientId: clientId ?? undefined });
      if (presetClientId)
        navigate({ to: "/clients/$clientId", params: { clientId: presetClientId } });
      else navigate({ to: "/paiements" });
    },
    onError: (e: unknown) => toast.error(friendlyError(e, "Erreur")),
  });

  const selectedFactures = useMemo(
    () => factures.filter((f) => f.facture_id in allocs),
    [factures, allocs],
  );

  const recapLignes: RecapLine[] = useMemo(
    () =>
      selectedFactures
        .filter((f) => Number(allocs[f.facture_id]) > 0)
        .map((f) => computeRecap(f.reference, Number(f.solde), Number(allocs[f.facture_id]))),
    [selectedFactures, allocs],
  );

  function validate(): boolean {
    const entries = Object.entries(allocs).filter(([, m]) => Number(m) > 0);
    if (!entries.length) {
      toast.error("Veuillez sélectionner au moins une facture");
      return false;
    }
    for (const [fid, m] of entries) {
      const f = factures.find((x) => x.facture_id === fid);
      if (!f) continue;
      if (Number(m) > Number(f.solde) + 0.01) {
        toast.error(`Le montant affecté dépasse le solde de la facture ${f.reference}`);
        return false;
      }
    }
    const parsed = paiementSchema.safeParse({
      montant: Number(form.montant),
      mode_paiement: form.mode_paiement,
      reference_paiement: (form.reference_paiement ?? "").trim(),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return false;
    }
    if (totalAffecte > Number(form.montant) + 0.01) {
      toast.error("Le total affecté aux factures dépasse le montant reçu");
      return false;
    }
    return true;
  }

  const submit = () => {
    if (!validate()) return;
    setConfirmOpen(true);
  };

  const doSave = () => {
    setConfirmOpen(false);
    const allocations: AllocationInput[] = Object.entries(allocs)
      .filter(([, m]) => Number(m) > 0)
      .map(([facture_id, montant]) => ({ facture_id, montant: Number(montant) }));
    if (!allocations.length) return;
    mutation.mutate({ ...form, client_id: clientId, allocations });
  };

  const preview = () => {
    if (validate()) setMode("confirm");
  };

  const hasSelection = selectedFactures.length > 0;
  const soldeRestant =
    selectedFactures.length === 1 ? Number(selectedFactures[0].solde) : undefined;

  if (clientError) {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-10">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Client invalide</AlertTitle>
          <AlertDescription>{clientError}</AlertDescription>
        </Alert>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/clients">Retour à la liste clients</Link>
          </Button>
          <Button asChild>
            <Link to="/paiements">Voir les paiements</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/paiements">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <CreditCard className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Nouveau paiement</h1>
          <p className="text-sm text-muted-foreground">
            Enregistrement d'un règlement client à imputer sur une ou plusieurs factures
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Sélection du client</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientSearchSelect
            value={clientId}
            onChange={(id, client) => {
              setClientId(id);
              setClientNom(client?.nom ?? "");
              setAllocs({});
              setForm((s) => ({ ...s, montant: 0 }));
            }}
          />
        </CardContent>
      </Card>

      {clientId && (
        <FacturesImpayeesCard
          clientNom={clientNom}
          factures={factures}
          loading={facLoading}
          selected={allocs}
          onToggle={toggleFacture}
          onMontantChange={changeMontant}
        />
      )}

      {hasSelection && (
        <PaiementFormCard
          form={form}
          setForm={setForm}
          mode={mode}
          soldeRestant={soldeRestant}
          onPreview={preview}
          onSubmit={submit}
          onEdit={() => setMode("draft")}
          submitting={mutation.isPending}
        />
      )}

      {hasSelection && recapLignes.length > 0 && <RecapCard lignes={recapLignes} mode={mode} />}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer l'enregistrement du paiement</AlertDialogTitle>
            <AlertDialogDescription>
              Vérifiez le récapitulatif ci-dessous avant d'enregistrer définitivement le paiement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {recapLignes.length > 0 && (
            <div className="space-y-2 rounded-md border p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Client</span>
                <span className="font-medium">{clientNom || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date paiement</span>
                <span>{formatDate(form.date_paiement)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mode</span>
                <span className="capitalize">{form.mode_paiement}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Référence</span>
                <span className="font-mono text-xs">{form.reference_paiement}</span>
              </div>
              <div className="my-2 border-t" />
              {recapLignes.map((rec) => (
                <div key={rec.reference} className="space-y-1">
                  <div className="flex justify-between">
                    <span className="font-mono text-xs">{rec.reference}</span>
                    <span className="font-semibold text-primary">
                      {formatFCFA(rec.montant_impute)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      Reste avant : {formatFCFA(rec.reste_avant)}
                    </span>
                    <span>Reste après : {formatFCFA(rec.reste_apres)}</span>
                  </div>
                </div>
              ))}
              <div className="my-2 border-t" />
              <div className="flex justify-between font-semibold text-primary">
                <span>Montant total imputé</span>
                <span>{formatFCFA(recapLignes.reduce((s, l) => s + l.montant_impute, 0))}</span>
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={doSave} disabled={mutation.isPending}>
              {mutation.isPending ? "Enregistrement…" : "Confirmer et enregistrer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
