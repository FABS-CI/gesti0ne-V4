import { formatDocumentReference } from "@/lib/document-reference";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { ClientsDebiteursSelector } from "@/components/paiements/nouveau/ClientsDebiteursSelector";
import {
  FacturesImpayeesCard,
  type FactureImpayeeRow,
} from "@/components/paiements/nouveau/FacturesImpayeesCard";
import { PaiementFormCard, PaiementFormActions, type FormState } from "@/components/paiements/nouveau/PaiementFormCard";
import { RecapCard } from "@/components/paiements/nouveau/RecapCard";
import { formatFCFA, formatDate } from "@/lib/format";
import { computeRecap, repartirMontantRecu, type RecapLine } from "@/lib/paiement-recap";

import { newIdempotencyKey } from "@/lib/idempotency";
import {
  enregistrerPaiementMulti,
  listFacturesImpayeesClient,
  getPaiementDette,
  type AllocationInput,
  type EnregistrerPaiementMultiInput,
} from "@/lib/paiements-api";
import { getClient } from "@/lib/clients-api";
import { paiementSchema } from "@/lib/paiement-recap";
import { invalidatePaiement } from "@/lib/cache-invalidation";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { friendlyError } from "@/lib/friendly-error";
import { paiementDetteMessage, paiementEntierementAffecte } from "@/lib/paiement-dette";

const searchSchema = z.object({
  clientId: fallback(z.string().optional(), undefined).default(undefined),
});

export const Route = createFileRoute("/_authenticated/paiements/nouveau")({
  head: () => ({ meta: [
    { title: "Nouveau paiement client | GESTI-one FABS-CI" },
    { name: "description", content: "Enregistrement des règlements clients sur une ou plusieurs factures, dans la limite de la dette restante." },
    { property: "og:title", content: "Nouveau paiement client | GESTI-one FABS-CI" },
    { property: "og:description", content: "Règlements clients et contrôle du montant restant dû." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
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
  const saving = useRef(false);
  const [checking, setChecking] = useState(false);

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

  const facturesQuery = useQuery({
    queryKey: ["factures-impayees", clientId],
    queryFn: () => (clientId ? listFacturesImpayeesClient(clientId) : Promise.resolve([])),
    enabled: !!clientId,
    staleTime: 0,
    refetchInterval: 15_000,
  });
  const factures = facturesQuery.data ?? [];
  const facLoading = facturesQuery.isLoading;
  const detteQuery = useQuery({
    queryKey: ["paiement-dette", clientId],
    queryFn: () => clientId ? getPaiementDette(clientId) : Promise.reject(new Error("Client obligatoire")),
    enabled: !!clientId,
    staleTime: 0,
    refetchInterval: 15_000,
  });

  const totalAffecte = useMemo(
    () => Object.values(allocs).reduce((s, m) => s + (Number(m) || 0), 0),
    [allocs],
  );

  const toggleFacture = (f: FactureImpayeeRow, checked: boolean) => {
    const ids = new Set(Object.keys(allocs));
    if (checked) ids.add(f.facture_id);
    else ids.delete(f.facture_id);

    const selection = factures.filter((facture) => ids.has(facture.facture_id));
    const premierMontant = checked && Object.keys(allocs).length === 0 && form.montant <= 0
      ? Number(f.solde)
      : Number(form.montant);
    if (premierMontant !== form.montant) {
      setForm((s) => ({ ...s, montant: premierMontant }));
    }
    setAllocs(repartirMontantRecu(premierMontant, selection));
  };

  const changeMontant = (factureId: string, montant: number) => {
    setAllocs((prev) => {
      return { ...prev, [factureId]: montant };
    });
  };

  const changeMontantRecu = (montant: number) => {
    const montantValide = Math.max(0, Number(montant) || 0);
    setForm((s) => ({ ...s, montant: montantValide }));
    setAllocs((prev) => {
      const selection = factures.filter((f) => f.facture_id in prev);
      return repartirMontantRecu(montantValide, selection);
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
    onError: (e: unknown) => {
      toast.error(friendlyError(e, "Erreur"));
      void detteQuery.refetch();
      void facturesQuery.refetch();
    },
    onSettled: () => { saving.current = false; },
  });

  const selectedFactures = useMemo(
    () => factures.filter((f) => f.facture_id in allocs),
    [factures, allocs],
  );
  const selectionDue = selectedFactures.reduce((sum, f) => sum + Number(f.solde), 0);
  const detteMessage = detteQuery.data
    ? paiementDetteMessage(detteQuery.data, Number(form.montant), selectedFactures.length ? selectionDue : undefined)
    : null;
  const paiementBlocked = !!clientId && (!detteQuery.data || detteQuery.isError || facturesQuery.isError || !!detteMessage);

  const recapLignes: RecapLine[] = useMemo(
    () =>
      selectedFactures
        .filter((f) => Number(allocs[f.facture_id]) > 0)
        .map((f) => computeRecap(f.reference, Number(f.solde), Number(allocs[f.facture_id]))),
    [selectedFactures, allocs],
  );

  function validate(): boolean {
    if (paiementBlocked) {
      toast.error(detteMessage ?? "Solde indisponible. Réessayez avant d’enregistrer le paiement.");
      return false;
    }
    const entries = Object.entries(allocs).filter(([, m]) => Number(m) > 0);
    if (!entries.length) {
      toast.error("Veuillez sélectionner au moins une facture");
      return false;
    }
    for (const [fid, m] of entries) {
      const f = factures.find((x) => x.facture_id === fid);
      if (!f) continue;
      if (Number(m) > Number(f.solde)) {
        toast.error(`Le montant affecté dépasse le solde de la facture ${formatDocumentReference(f.reference)}`);
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
    if (!paiementEntierementAffecte(Number(form.montant), totalAffecte)) {
      toast.error("Le montant reçu doit être entièrement affecté aux factures sélectionnées");
      return false;
    }
    return true;
  }

  const submit = () => {
    if (!validate()) return;
    setConfirmOpen(true);
  };

  const doSave = async () => {
    if (saving.current || checking || mutation.isPending) return;
    saving.current = true;
    setChecking(true);
    const allocations: AllocationInput[] = Object.entries(allocs)
      .filter(([, m]) => Number(m) > 0)
      .map(([facture_id, montant]) => ({ facture_id, montant: Number(montant) }));
    try {
      if (!clientId || !allocations.length || !validate()) return;
      const [debt, invoices] = await Promise.all([detteQuery.refetch(), facturesQuery.refetch()]);
      if (debt.error || invoices.error || !debt.data || !invoices.data) throw new Error("Solde indisponible. Réessayez avant d’enregistrer le paiement.");
      const selected = invoices.data.filter(f => allocations.some(a => a.facture_id === f.facture_id));
      const message = paiementDetteMessage(debt.data, Number(form.montant), selected.reduce((s, f) => s + Number(f.solde), 0));
      if (message) throw new Error(message);
      if (allocations.some(a => !selected.some(f => f.facture_id === a.facture_id && a.montant <= Number(f.solde)))) throw new Error("Le solde des factures a changé. Vérifiez les montants avant de réessayer.");
      setConfirmOpen(false);
      await mutation.mutateAsync({ ...form, client_id: clientId, allocations });
    } catch (e) {
      if (!mutation.isPending) toast.error(friendlyError(e, "Paiement refusé"));
    } finally {
      saving.current = false;
      setChecking(false);
    }
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
        <Button aria-label="Retour" asChild variant="ghost" size="icon">
          <Link to="/paiements">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <CreditCard className="h-6 w-6 text-primary" />
        <div>
          <h1 className="ds-page-title">Nouveau paiement</h1>
          <p className="text-sm text-muted-foreground">
            Enregistrement d'un règlement client à imputer sur une ou plusieurs factures
          </p>
        </div>
      </div>

      <ClientsDebiteursSelector
        value={clientId}
        onSelect={(client) => {
          setClientId(client.client_id);
          setClientNom(client.nom);
          setAllocs({});
          setForm((s) => ({ ...s, montant: 0 }));
        }}
      />

      {clientId && detteQuery.data && <div className="text-sm text-muted-foreground">
        Montant disponible : <span className="font-semibold text-foreground">{formatFCFA(detteQuery.data.disponible)}</span>
        {detteQuery.data.reserve > 0 && <span> · Paiements en attente : {formatFCFA(detteQuery.data.reserve)}</span>}
      </div>}
      {clientId && (detteMessage || detteQuery.isError || facturesQuery.isError) && <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{detteMessage ?? "Solde indisponible. Réessayez avant d’enregistrer le paiement."}</AlertDescription>
      </Alert>}

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
          onMontantChange={changeMontantRecu}
          submitting={mutation.isPending || checking || paiementBlocked}
        />
      )}

      {hasSelection && recapLignes.length > 0 && <RecapCard lignes={recapLignes} mode={mode} />}

      {hasSelection && (
        <PaiementFormActions
          mode={mode}
          onPreview={preview}
          onSubmit={submit}
          onEdit={() => setMode("draft")}
          submitting={mutation.isPending || checking || paiementBlocked}
        />
      )}

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
                    <span className="font-mono text-xs">{formatDocumentReference(rec.reference)}</span>
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
            <AlertDialogAction onClick={doSave} disabled={mutation.isPending || checking || paiementBlocked}>
              {mutation.isPending || checking ? "Enregistrement…" : "Confirmer et enregistrer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
