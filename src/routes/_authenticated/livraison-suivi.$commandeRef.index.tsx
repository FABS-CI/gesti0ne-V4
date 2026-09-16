import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, Clock, User, Pencil, Trash2, Check, X, Zap } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Can } from "@/components/rbac/Can";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useUserRoles } from "@/hooks/use-user-roles";
import {
  getSuiviByCommandeRef,
  getHistoriquePage,
  getHistoriqueCount,
  workflowSteps,
  nextEtape,
  STATUT_LABEL,
  STATUT_COLOR,
  updateHistoriqueCommentaire,
  deleteHistorique,
} from "@/lib/livraison-suivi-api";
import { computeSuiviDefaults } from "@/lib/livraison-suivi/defaults";
import { AvancerEtapeDialog } from "@/components/livraison-suivi/AvancerEtapeDialog";
import { ConfirmerReceptionDialog } from "@/components/livraison-suivi/ConfirmerReceptionDialog";
import { useConfirmDelete } from "@/hooks/use-confirm-delete";

import { zodValidator } from "@tanstack/zod-adapter";
import { commandeRefSearchSchema, COMMANDE_REF_SEARCH_DEFAULTS } from "@/lib/route-schemas";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { friendlyError } from "@/lib/friendly-error";

export const Route = createFileRoute("/_authenticated/livraison-suivi/$commandeRef/")({
  validateSearch: zodValidator(commandeRefSearchSchema),
  component: SuiviDetail,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

const META_LABEL: Record<string, string> = {
  livreur_nom: "Transporteur / agent",
  vehicule: "Véhicule / n° BSC",
  gare_destination: "Gare",
  ville_destination: "Ville",
  receptionnaire_nom: "Réceptionnaire",
};

function SuiviDetail() {
  const { commandeRef } = Route.useParams();
  const { debug } = Route.useSearch();
  const HISTO_PAGE = 25;
  const [open, setOpen] = useState(false);
  const [openRecept, setOpenRecept] = useState(false);
  const perfRef = useRef({ detailMs: 0, histoMs: 0, roundTrips: 0 });
  const [, forcePerfRender] = useState(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const qc = useQueryClient();
  const { isSuperAdmin, hasAny } = useUserRoles();
  const canEdit = isSuperAdmin || hasAny(["service_logistique"]);

  const {
    data: suivi,
    isLoading,
    isError: detailError,
    error: detailErrorObj,
    refetch,
    isFetching: detailFetching,
  } = useQuery({
    queryKey: ["livsuivi", "detail", commandeRef],
    queryFn: async () => {
      const t = performance.now();
      try {
        return await getSuiviByCommandeRef(commandeRef);
      } finally {
        perfRef.current.detailMs = performance.now() - t;
        perfRef.current.roundTrips += 2; // getSuiviByCommandeRef fait 2 round-trips
        if (debug) forcePerfRender((n) => n + 1);
      }
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 2,
  });
  // Historique paginé (scroll infini) : chaque page = 25 items.
  const {
    data: histoData,
    isLoading: histoLoading,
    isError: histoError,
    error: histoErrorObj,
    refetch: refetchHisto,
    isFetching: histoFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["livsuivi", "histo", suivi?.id],
    initialPageParam: 0,
    enabled: !!suivi?.id,
    staleTime: 30_000,
    retry: 2,
    queryFn: async ({ pageParam }) => {
      if (!suivi) return { rows: [], nextOffset: null as number | null };
      const t = performance.now();
      try {
        return await getHistoriquePage(suivi.id, {
          offset: pageParam as number,
          limit: HISTO_PAGE,
        });
      } finally {
        perfRef.current.histoMs = performance.now() - t;
        perfRef.current.roundTrips += 1;
        if (debug) forcePerfRender((n) => n + 1);
      }
    },
    getNextPageParam: (last) => last.nextOffset,
  });
  // Total mis en cache séparément — pas de recompte sur scroll ni sur refetch d'une page.
  const { data: histoTotal = 0 } = useQuery({
    queryKey: ["livsuivi", "histo-count", suivi?.id],
    queryFn: () => (suivi ? getHistoriqueCount(suivi.id) : Promise.resolve(0)),
    enabled: !!suivi?.id,
    staleTime: 60_000,
  });
  // Déduplication par id (protège contre doublons realtime éventuels).
  const histo = useMemo(() => {
    type Row = NonNullable<typeof histoData>["pages"][number]["rows"][number];
    const map = new Map<string, Row>();
    for (const page of histoData?.pages ?? []) for (const r of page.rows) map.set(r.id, r);
    return Array.from(map.values());
  }, [histoData]);

  // Rafraîchissement temps réel : dès qu'une étape est validée (ligne
  // livsuivi_historique) ou que le statut de la livraison change,
  // on invalide le cache pour re-fetch commande + colis + tournée.
  useEffect(() => {
    if (!suivi?.id) return;
    const ch = supabase
      .channel(`livsuivi-detail-${suivi.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "livsuivi_commandes", filter: `id=eq.${suivi.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["livsuivi", "detail", commandeRef] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "livsuivi_historique",
          filter: `livraison_id=eq.${suivi.id}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["livsuivi", "histo", suivi.id] });
          qc.invalidateQueries({ queryKey: ["livsuivi", "histo-count", suivi.id] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [suivi?.id, commandeRef, qc]);

  // IntersectionObserver — déclenche fetchNextPage quand le sentinel apparaît.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, histo.length]);

  const computed = useMemo(() => {
    if (!suivi) return null;
    const steps = workflowSteps(suivi.type_livraison);
    const idx = steps.indexOf(suivi.statut);
    const pct = ((idx + 1) / steps.length) * 100;
    const next = nextEtape(suivi.type_livraison, suivi.statut);
    const colis = suivi.colis ?? null;
    const isExpedition = suivi.type_livraison === "expedition";
    const defaults = computeSuiviDefaults(suivi);
    return { steps, idx, pct, next, colis, isExpedition, defaults };
  }, [suivi]);

  if (isLoading)
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  if (detailError)
    return (
      <div className="p-6">
        <ErrorCard
          title="Échec du chargement du suivi"
          message={(detailErrorObj as Error)?.message ?? "Erreur inconnue"}
          onRetry={() => refetch()}
          retrying={detailFetching}
        />
      </div>
    );
  if (!suivi)
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Aucun suivi pour cette commande.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/livraison-suivi">Retour</Link>
        </Button>
      </div>
    );
  const { steps, idx, pct, next, colis, isExpedition, defaults } = computed!;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/livraison-suivi">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Suivi — {suivi.commande?.reference}</h1>
          <p className="text-sm text-muted-foreground">
            {suivi.commande?.client_nom} · {suivi.commande?.ville ?? ""}
          </p>
        </div>
        <div className="ml-auto">
          {next === "remise_livreur" || next === "remise_transporteur" ? (
            <Button asChild>
              <Link to="/livraison-suivi/$commandeRef/remise" params={{ commandeRef }} search={COMMANDE_REF_SEARCH_DEFAULTS}>
                {next === "remise_transporteur" ? "Remise au transporteur" : "Remise au livreur"}
              </Link>
            </Button>
          ) : next || suivi.statut === "arrivee_gare" ? (
            <Button onClick={() => setOpen(true)}>Avancer d'une étape</Button>
          ) : suivi.statut !== "reception_confirmee" ? (
            <Button onClick={() => setOpenRecept(true)}>Confirmer réception</Button>
          ) : (
            <Badge variant="outline">Livraison terminée</Badge>
          )}
        </div>
      </div>

      <div className="rounded-md border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <Badge style={{ backgroundColor: STATUT_COLOR[suivi.statut], color: "white" }}>
            {STATUT_LABEL[suivi.statut]}
          </Badge>
          <Badge variant="secondary">
            {suivi.type_livraison === "direct" ? "Livraison directe" : "Expédition"}
          </Badge>
        </div>
        <Progress value={pct} className="h-3" />
        <div className="grid gap-2 sm:grid-cols-5 text-xs">
          {steps.map((s, i) => (
            <div
              key={s}
              className={`rounded-md border p-2 text-center ${
                i < idx
                  ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                  : i === idx
                    ? "bg-blue-50 border-blue-300 text-blue-800 font-semibold"
                    : "text-muted-foreground"
              }`}
            >
              {i + 1}. {STATUT_LABEL[s]}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-md border bg-card p-4 space-y-2 text-sm">
          <h3 className="font-semibold mb-2">Informations</h3>
          <InfoRow label="N° Bon de livraison" value={colis?.bl_reference} />
          <InfoRow label="N° Colis" value={colis?.reference} />
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
          <InfoRow label="Nombre de colis" value={colis ? String(colis.nb_colis) : null} />
          <InfoRow
            label="Date de livraison"
            value={
              colis?.bl_date_livraison
                ? new Date(colis.bl_date_livraison).toLocaleDateString("fr-FR")
                : colis?.date_envoi
                  ? new Date(colis.date_envoi).toLocaleDateString("fr-FR")
                  : null
            }
          />
          <InfoRow
            label="Service / Mode"
            value={colis?.mode_acheminement ?? (isExpedition ? "Expédition" : "Livraison directe")}
          />
          <InfoRow label="Expéditeur" value={colis?.depot_nom} />
          <InfoRow label="Destinataire" value={colis?.destinataire ?? suivi.commande?.client_nom} />
          <InfoRow label="Transporteur" value={colis?.transporteur} />
          <InfoRow
            label="Livreur / Transporteur"
            value={
              suivi.livreur_nom ??
              colis?.livreur_nom ??
              colis?.transporteur ??
              suivi.tournee?.livreur_nom
            }
          />
          <InfoRow
            label="Véhicule / n° BSC"
            value={suivi.vehicule ?? colis?.vehicule ?? suivi.tournee?.vehicule}
          />
          {isExpedition && (
            <>
              <InfoRow label="Gare de départ" value={colis?.gare_depart} />
              <InfoRow label="Chef de gare" value={colis?.gare_responsable} />
              <InfoRow label="Tél. chef de gare" value={colis?.gare_telephone} />
            </>
          )}
          <InfoRow
            label="Gare de destination"
            value={suivi.gare_destination ?? colis?.gare_depart}
          />
          <InfoRow
            label="Ville de destination"
            value={suivi.ville_destination ?? colis?.ville_destination ?? colis?.ville_livraison}
          />
          <InfoRow label="Commune" value={colis?.commune} />
          <InfoRow label="Quartier" value={colis?.quartier} />
          <InfoRow
            label="Réceptionnaire"
            value={suivi.receptionnaire_nom ?? suivi.commande?.client_nom}
          />
          <InfoRow label="Tél. livreur" value={colis?.livreur_telephone} />
          <InfoRow label="Téléphone client" value={suivi.commande?.telephone ?? null} />
          <InfoRow label="Contenu" value={colis?.contenu} />
        </div>
        <div className="rounded-md border bg-card p-4">
          <h3 className="font-semibold mb-3">Historique chronologique des étapes</h3>
          <ol className="space-y-3">
            {histoLoading && (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            )}
            {histoError && !histoLoading && (
              <ErrorCard
                title="Historique indisponible"
                message={(histoErrorObj as Error)?.message ?? "Erreur inconnue"}
                onRetry={() => refetchHisto()}
                retrying={histoFetching}
              />
            )}
            {!histoLoading && !histoError && histo.map((h) => (
              <HistoRow
                key={h.id}
                h={h}
                canEdit={canEdit}
                canDelete={isSuperAdmin}
                onChanged={() =>
                  qc.invalidateQueries({ queryKey: ["livsuivi", "histo", suivi.id] })
                }
              />
            ))}
            {!histoLoading && !histoError && histo.length === 0 && (
              <p className="text-xs text-muted-foreground">Aucun événement.</p>
            )}
          </ol>
          {!histoLoading && !histoError && (
            <div
              ref={sentinelRef}
              data-testid="histo-sentinel"
              className="mt-3 flex items-center justify-center text-xs text-muted-foreground h-8"
            >
              {isFetchingNextPage
                ? "Chargement…"
                : hasNextPage
                  ? `${histo.length} / ${histoTotal} étapes`
                  : histo.length > 0
                    ? `${histo.length} étape${histo.length > 1 ? "s" : ""} · tout chargé`
                    : null}
            </div>
          )}
        </div>
      </div>

      {debug && (
        <div className="fixed bottom-4 right-4 z-50 rounded-md border bg-background/95 shadow-lg px-3 py-2 text-xs font-mono space-y-0.5">
          <div className="flex items-center gap-1 font-semibold">
            <Zap className="h-3 w-3" /> Debug perf
          </div>
          <div>détail : {perfRef.current.detailMs.toFixed(0)} ms</div>
          <div>historique : {perfRef.current.histoMs.toFixed(0)} ms</div>
          <div>round-trips : {perfRef.current.roundTrips}</div>
        </div>
      )}

      <AvancerEtapeDialog
        target={open ? { ...suivi, commande: suivi.commande ?? null } : null}
        defaults={defaults}
        onClose={() => {
          setOpen(false);
          refetch();
        }}
      />

      <ConfirmerReceptionDialog
        open={openRecept}
        onOpenChange={setOpenRecept}
        livraisonId={suivi.id}
        defaultReceptionnaire={suivi.receptionnaire_nom ?? suivi.commande?.client_nom ?? null}
        onSuccess={() => refetch()}
      />

      {(suivi.signature_url || suivi.photo_preuve_url || suivi.commentaire_reception) && (
        <div className="rounded-md border bg-card p-4 space-y-3">
          <h3 className="font-semibold">Preuves de livraison</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {suivi.signature_url && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">Signature</div>
                <img src={suivi.signature_url} alt="Signature" className="border rounded-md bg-white max-h-40" />
              </div>
            )}
            {suivi.photo_preuve_url && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">Bon signé</div>
                <img src={suivi.photo_preuve_url} alt="Bon signé" className="border rounded-md max-h-40" />
              </div>
            )}
          </div>
          {suivi.commentaire_reception && (
            <div className="text-sm">
              <span className="text-xs text-muted-foreground">Commentaire : </span>
              {suivi.commentaire_reception}
            </div>
          )}
          {suivi.receptionnaire_telephone && (
            <div className="text-sm">
              <span className="text-xs text-muted-foreground">Tél. réceptionnaire : </span>
              {suivi.receptionnaire_telephone}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{value || "—"}</span>
    </div>
  );
}

function ErrorCard({
  title,
  message,
  onRetry,
  retrying,
}: {
  title: string;
  message: string;
  onRetry: () => void;
  retrying?: boolean;
}) {
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 flex items-start gap-3">
      <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
      <div className="flex-1 space-y-1">
        <div className="text-sm font-medium text-destructive">{title}</div>
        <div className="text-xs text-muted-foreground break-words">{message}</div>
      </div>
      <Button size="sm" variant="outline" onClick={onRetry} disabled={retrying}>
        {retrying ? "…" : "Réessayer"}
      </Button>
    </div>
  );
}

function HistoRow({
  h,
  canEdit,
  canDelete,
  onChanged,
}: {
  h: {
    id: string;
    etape: keyof typeof STATUT_LABEL;
    commentaire: string | null;
    created_at: string;
    user_nom: string | null;
    meta?: Record<string, unknown> | null;
  };
  canEdit: boolean;
  canDelete: boolean;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(h.commentaire ?? "");
  const { confirm, dialog: confirmDialog } = useConfirmDelete();

  const mutUpd = useMutation({
    mutationFn: () => updateHistoriqueCommentaire(h.id, value),
    onSuccess: () => {
      toast.success("Étape modifiée");
      setEditing(false);
      onChanged();
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  const mutDel = useMutation({
    mutationFn: () => deleteHistorique(h.id),
    onSuccess: () => {
      toast.success("Étape supprimée");
      onChanged();
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  return (
    <li className="flex gap-3 text-sm border-l-2 border-primary/40 pl-3">
      <div className="flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="font-medium">{STATUT_LABEL[h.etape]}</div>
          <div className="flex gap-1">
            {canEdit && !editing && (
              <Button size="icon" variant="ghost" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {canDelete && !editing && (
              <Can permission="livraisons.supprimer">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={async () => {
                    const r = await confirm({
                      title: "Supprimer cette étape ?",
                      entityLabel: "l'étape de l'historique",
                      entityName: STATUT_LABEL[h.etape],
                    });
                    if (r === false) return;
                    mutDel.mutate();
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </Can>
            )}
          </div>
        </div>
        {editing ? (
          <div className="flex gap-2 mt-1">
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Commentaire"
              className="h-8"
            />
            <Button size="icon" variant="ghost" onClick={() => mutUpd.mutate()}>
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                setValue(h.commentaire ?? "");
                setEditing(false);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          h.commentaire && <div className="text-xs text-muted-foreground">{h.commentaire}</div>
        )}
        {h.meta && Object.keys(h.meta).length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {Object.entries(h.meta).map(([k, v]) => {
              const val = v == null ? "" : String(v);
              if (!val) return null;
              return (
                <Badge key={k} variant="secondary" className="text-[10px] font-normal">
                  {META_LABEL[k] ?? k} : {val}
                </Badge>
              );
            })}
          </div>
        )}
        <div className="text-[11px] text-muted-foreground flex gap-3 mt-1">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {new Date(h.created_at).toLocaleString("fr-FR")}
          </span>
          {h.user_nom && (
            <span className="inline-flex items-center gap-1">
              <User className="h-3 w-3" />
              {h.user_nom}
            </span>
          )}
        </div>
      </div>
      {confirmDialog}
    </li>
  );
}
