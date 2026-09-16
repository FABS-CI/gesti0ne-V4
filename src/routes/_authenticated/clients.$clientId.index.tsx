import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, Mail, MessageCircle, Pencil, PlusCircle, RotateCcw, Wallet, ReceiptText } from "lucide-react";

import { TYPE_COLOR, normalizeTypeClient } from "@/lib/company";
import { formatFCFA } from "@/lib/format";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions } from "@/hooks/use-permissions";
import { ClientEditSheet } from "@/components/clients/ClientEditSheet";
import { Kpi, ReportANouveauKpi } from "@/components/clients/detail/shared";
import { ClientInfosTab } from "@/components/clients/detail/ClientInfosTab";
import { ClientCommandesTab } from "@/components/clients/detail/ClientCommandesTab";
import { ClientFacturesTab } from "@/components/clients/detail/ClientFacturesTab";
import { ClientPaiementsTab } from "@/components/clients/detail/ClientPaiementsTab";
import { ClientStatsTab } from "@/components/clients/detail/ClientStatsTab";
import { ClientAuditTab } from "@/components/clients/detail/ClientAuditTab";
import {
  ClientProformasTab,
  ClientBLTab,
  ClientAvoirsTab,
  ClientLivraisonsTab,
} from "@/components/clients/detail/ClientSimpleTabs";
import { Section } from "@/components/ui/section";
import { SkeletonTable, SkeletonKpiRow } from "@/components/ui/skeletons";
import {
  clientQO,
  clientCountsQO,
  clientCommandesQO,
  clientFacturesQO,
  clientProformasQO,
  clientBLQO,
  clientAvoirsQO,
  clientPaiementsQO,
  clientLivraisonsQO,
} from "@/lib/client-detail-queries";
import { useClientRealtime } from "@/hooks/use-client-realtime";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";


export const Route = createFileRoute("/_authenticated/clients/$clientId/")({
  component: ClientDetailPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function ClientDetailPage() {
  const { clientId } = Route.useParams();
  return (
    <Section fallback={<div className="py-16 text-center text-muted-foreground">Chargement…</div>}>
      <ClientDetailInner clientId={clientId} />
    </Section>
  );
}

function ClientDetailInner({ clientId }: { clientId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const { has } = usePermissions();
  const canSeeSolde = has("clients.voir_ca");

  useClientRealtime(clientId);

  const { data: client } = useSuspenseQuery(clientQO(clientId));
  const { data: factures } = useSuspenseQuery(clientFacturesQO(clientId));
  const { data: counts } = useSuspenseQuery(clientCountsQO(clientId));
  // Précharge en idle les onglets les plus consultés
  useEffect(() => {
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const run = () => {
      queryClient.prefetchQuery(clientCommandesQO(clientId));
      queryClient.prefetchQuery(clientPaiementsQO(clientId));
      queryClient.prefetchQuery(clientProformasQO(clientId));
    };
    if (typeof w.requestIdleCallback === "function") {
      const id = w.requestIdleCallback(run, { timeout: 2000 });
      return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(run, 400);
    return () => window.clearTimeout(id);
  }, [clientId, queryClient]);

  const prefetchOnHover = (fn: () => void) => ({ onMouseEnter: fn, onFocus: fn });

  const type = TYPE_COLOR[normalizeTypeClient(client.type_client)];
  const encoursFactures = factures.reduce((s, f) => {
    if (f.statut === "annulee" || f.statut === "avoir") return s;
    const solde = Number(f.montant_total) - Number(f.montant_paye);
    return solde > 0 ? s + solde : s;
  }, 0);
  const soldeClient = Number(client.solde) || 0;
  const encours = Math.max(encoursFactures, soldeClient > 0 ? soldeClient : 0);

  const plafond = Number(client.plafond_credit) || 0;
  const tauxCredit = plafond > 0 ? Math.min(100, Math.round((encours / plafond) * 100)) : 0;
  const facturesImpayees = factures.filter(
    (f) =>
      f.statut !== "annulee" &&
      f.statut !== "avoir" &&
      Number(f.montant_total) - Number(f.montant_paye) > 0,
  );
  const creditDisponible = Math.max(0, plafond - encours);

  const statutEnrichi = !client.actif
    ? { label: "Inactif", cls: "bg-muted text-muted-foreground" }
    : facturesImpayees.length > 0 && tauxCredit > 90
      ? { label: "Plafond critique", cls: "bg-red-500 text-white" }
      : tauxCredit > 70
        ? { label: "Encours élevé", cls: "bg-amber-500 text-white" }
        : facturesImpayees.length > 0
          ? { label: "Impayés", cls: "bg-orange-500 text-white" }
          : { label: "Actif", cls: "bg-emerald-500 text-white" };


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/clients">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{client.nom}</h1>
            <p className="font-mono text-xs text-muted-foreground">{client.reference}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            className="bg-orange-500 hover:bg-orange-600 text-white"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="mr-2 h-4 w-4" /> Modifier le client
          </Button>
          <Button
            onClick={() =>
              navigate({
                to: "/commandes",
                search: { q: "", statut: "all", clientId: client.client_id },
              })
            }
          >
            <PlusCircle className="mr-2 h-4 w-4" /> Commander
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              navigate({ to: "/paiements/nouveau", search: { clientId: client.client_id } })
            }
          >
            <Wallet className="mr-2 h-4 w-4" /> Imputer un paiement
          </Button>
          <Button
            variant="secondary"
            className="bg-purple-600 hover:bg-purple-700 text-white"
            onClick={() =>
              navigate({ to: "/retours/nouveau", search: { clientId: client.client_id, type_retour: "avoir" } })
            }
          >
            <ReceiptText className="mr-2 h-4 w-4" /> Avoir
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              navigate({ to: "/retours/nouveau", search: { clientId: client.client_id, type_retour: "physique" } })
            }
          >
            <RotateCcw className="mr-2 h-4 w-4" /> Retour
          </Button>
          <Badge style={{ backgroundColor: type?.bg ?? "#CFD8DC", color: type?.color ?? "#0A2540" }}>
            {type?.label ?? client.type_client}
          </Badge>
          <Badge className={statutEnrichi.cls}>{statutEnrichi.label}</Badge>
        </div>
      </div>

      {/* Actions rapides */}
      <div className="flex flex-wrap gap-2">
        {client.telephone &&
          (() => {
            const waMessage = `Bonjour ${client.nom},`;
            return (
              <Button variant="outline" size="sm" asChild>
                <a
                  href={`https://wa.me/${client.telephone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(waMessage)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
                </a>
              </Button>
            );
          })()}
        {client.email && (
          <Button variant="outline" size="sm" asChild>
            <a href={`mailto:${client.email}`}>
              <Mail className="mr-2 h-4 w-4" /> Email
            </a>
          </Button>
        )}
        <Button
          size="sm"
          className="bg-orange-500 hover:bg-orange-600 text-white"
          onClick={() => setEditOpen(true)}
        >
          <Pencil className="mr-2 h-4 w-4" /> Modifier
        </Button>
      </div>

      <ClientEditSheet client={client} open={editOpen} onOpenChange={setEditOpen} />

      {/* KPIs */}
      <Section fallback={<SkeletonKpiRow count={canSeeSolde ? 8 : 4} />}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {canSeeSolde && (
            <>
              <Kpi label="Encours" value={formatFCFA(encours)} accent="text-red-600" />
              <Kpi label="Plafond crédit" value={formatFCFA(plafond)} />
              <Kpi
                label="Utilisation crédit"
                value={
                  <div>
                    <div className="text-xl font-bold">{tauxCredit}%</div>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
                      <div
                        className={`h-1.5 rounded-full ${tauxCredit > 90 ? "bg-red-500" : tauxCredit > 70 ? "bg-amber-500" : "bg-emerald-500"}`}
                        style={{ width: `${tauxCredit}%` }}
                      />
                    </div>
                  </div>
                }
              />
              <Kpi label="Solde" value={formatFCFA(client.solde)} />
              <Kpi label="Crédit disponible" value={formatFCFA(creditDisponible)} />
              <ReportANouveauKpi clientId={client.client_id} />
            </>
          )}
          <Kpi label="Commandes" value={String(counts.commandes)} />
          <Kpi label="Factures" value={String(counts.factures)} />
          <Kpi label="Bons de livraison" value={String(counts.bl)} />
          <Kpi label="Paiements" value={String(counts.paiements)} />
          <Kpi label="Livraisons" value={String(counts.livraisons)} />
          <Kpi label="Proformas" value={String(counts.proformas)} />
          <Kpi
            label="Avoirs"
            value={String(counts.avoirs)}
            className="cursor-pointer hover:bg-accent transition-colors"
            onClick={() => {
              const tabs = document.querySelector('[role="tablist"]');
              const avoirTab = tabs?.querySelector('[value="avoirs"]') as HTMLElement;
              avoirTab?.click();
            }}
          />
        </div>
      </Section>

      {/* Tabs */}
      <Tabs defaultValue="infos">
        <TabsList className="flex-wrap">
          <TabsTrigger value="infos">Informations</TabsTrigger>
          <TabsTrigger
            value="commandes"
            {...prefetchOnHover(() => queryClient.prefetchQuery(clientCommandesQO(clientId)))}
          >
            Commandes ({counts.commandes})
          </TabsTrigger>
          <TabsTrigger
            value="proformas"
            {...prefetchOnHover(() => queryClient.prefetchQuery(clientProformasQO(clientId)))}
          >
            Proformas ({counts.proformas})
          </TabsTrigger>
          <TabsTrigger value="factures">Factures ({counts.factures})</TabsTrigger>
          <TabsTrigger
            value="bl"
            {...prefetchOnHover(() => queryClient.prefetchQuery(clientBLQO(clientId)))}
          >
            BL ({counts.bl})
          </TabsTrigger>
          <TabsTrigger
            value="paiements"
            {...prefetchOnHover(() => queryClient.prefetchQuery(clientPaiementsQO(clientId)))}
          >
            Paiements ({counts.paiements})
          </TabsTrigger>
          <TabsTrigger
            value="livraisons"
            {...prefetchOnHover(() => queryClient.prefetchQuery(clientLivraisonsQO(clientId)))}
          >
            Livraisons ({counts.livraisons})
          </TabsTrigger>
          <TabsTrigger
            value="avoirs"
            {...prefetchOnHover(() => queryClient.prefetchQuery(clientAvoirsQO(clientId)))}
          >
            Avoirs ({counts.avoirs})
          </TabsTrigger>
          <TabsTrigger value="stats">Statistiques</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="infos" className="space-y-4" data-testid="client-readonly-card">
          <ClientInfosTab client={client} typeLabel={type?.label ?? client.type_client} />
        </TabsContent>

        <TabsContent value="commandes">
          <Section fallback={<SkeletonTable rows={6} cols={5} />}>
            <LazyCommandesTab clientId={clientId} />
          </Section>
        </TabsContent>

        <TabsContent value="proformas">
          <Section fallback={<SkeletonTable rows={6} cols={5} />}>
            <LazyProformasTab clientId={clientId} />
          </Section>
        </TabsContent>

        <TabsContent value="factures">
          <ClientFacturesTab factures={factures} />
        </TabsContent>

        <TabsContent value="bl">
          <Section fallback={<SkeletonTable rows={6} cols={6} />}>
            <LazyBLTab clientId={clientId} />
          </Section>
        </TabsContent>

        <TabsContent value="paiements">
          <Section fallback={<SkeletonTable rows={6} cols={5} />}>
            <LazyPaiementsTab clientId={clientId} />
          </Section>
        </TabsContent>

        <TabsContent value="livraisons">
          <Section fallback={<SkeletonTable rows={6} cols={5} />}>
            <LazyLivraisonsTab clientId={clientId} />
          </Section>
        </TabsContent>

        <TabsContent value="avoirs">
          <Section fallback={<SkeletonTable rows={6} cols={5} />}>
            <LazyAvoirsTab clientId={clientId} />
          </Section>
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          <Section fallback={<SkeletonKpiRow count={8} />}>
            <LazyStatsTab clientId={clientId} client={client} counts={counts} factures={factures} />
          </Section>
        </TabsContent>

        <TabsContent value="audit" className="space-y-3">
          <ClientAuditTab clientId={clientId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------- Lazy tab wrappers (Suspense-ready) ---------- */

function LazyCommandesTab({ clientId }: { clientId: string }) {
  const { data } = useSuspenseQuery(clientCommandesQO(clientId));
  return <ClientCommandesTab commandes={data} />;
}
function LazyProformasTab({ clientId }: { clientId: string }) {
  const { data } = useSuspenseQuery(clientProformasQO(clientId));
  return <ClientProformasTab proformas={data} />;
}
function LazyBLTab({ clientId }: { clientId: string }) {
  const { data } = useSuspenseQuery(clientBLQO(clientId));
  return <ClientBLTab bons_livraison={data} />;
}
function LazyPaiementsTab({ clientId }: { clientId: string }) {
  const { data } = useSuspenseQuery(clientPaiementsQO(clientId));
  return <ClientPaiementsTab paiements={data} />;
}
function LazyLivraisonsTab({ clientId }: { clientId: string }) {
  const { data } = useSuspenseQuery(clientLivraisonsQO(clientId));
  return <ClientLivraisonsTab livraisons={data} />;
}
function LazyAvoirsTab({ clientId }: { clientId: string }) {
  const { data } = useSuspenseQuery(clientAvoirsQO(clientId));
  return <ClientAvoirsTab avoirs={data} />;
}
function LazyStatsTab({
  clientId,
  client,
  counts,
  factures,
}: {
  clientId: string;
  client: Parameters<typeof ClientInfosTab>[0]["client"];
  counts: {
    commandes: number;
    proformas: number;
    bl: number;
    avoirs: number;
    factures: number;
    paiements: number;
    livraisons: number;
  };
  factures: Parameters<typeof ClientFacturesTab>[0]["factures"];
}) {
  const { data: commandes } = useSuspenseQuery(clientCommandesQO(clientId));
  const { data: paiements } = useSuspenseQuery(clientPaiementsQO(clientId));
  return (
    <ClientStatsTab
      client={client}
      counts={counts}
      factures={factures}
      commandes={commandes}
      paiements={paiements}
    />
  );
}
