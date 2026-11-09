import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/common/StatusPill";
import { ClientLink } from "@/components/common/ClientLink";
import { listFacturesPaginated, STATUT_FACTURE_LABEL } from "@/lib/factures-api";
import { getCrmDashboard } from "@/lib/crm-api";
import { FACTURE_STATUT_TONE } from "@/lib/statut-tone";
import { formatDocumentReference } from "@/lib/document-reference";
import { formatDate, formatFCFA } from "@/lib/format";
import type { Periode } from "@/lib/dashboard-helpers";

function Rows() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  );
}

/** Dernières factures (5) et meilleurs clients de la période — lecture seule. */
export function DashboardRecent({
  exerciceId,
  periode,
  canSeeCA,
}: {
  exerciceId: string | null;
  periode: Periode;
  canSeeCA: boolean;
}) {
  const factures = useQuery({
    queryKey: ["dashboard-dernieres-factures", exerciceId],
    enabled: !!exerciceId,
    staleTime: 60_000,
    queryFn: () => listFacturesPaginated({ exerciceId, page: 1, pageSize: 5 }),
  });
  const since = new Date(Date.now() - Number(periode) * 86400000).toISOString().slice(0, 10);
  const top = useQuery({
    queryKey: ["dashboard-top-clients", since],
    enabled: canSeeCA,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: () => getCrmDashboard(since),
  });
  const clients = (top.data?.top_clients ?? []).slice(0, 5);
  const maxCa = Math.max(1, ...clients.map((c) => Number(c.ca) || 0));

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="min-w-0 lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Dernières factures</CardTitle>
          <Link to="/factures" className="text-sm text-primary hover:underline">
            Tout voir
          </Link>
        </CardHeader>
        <CardContent className="pt-0">
          {factures.isLoading ? (
            <Rows />
          ) : (factures.data?.items.length ?? 0) === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Aucune facture pour cet exercice.</p>
          ) : (
            <ul className="divide-y">
              {factures.data!.items.map((f) => (
                <li key={f.facture_id} className="flex items-center gap-3 py-3 text-sm">
                  <Link
                    to="/factures/$factureId"
                    params={{ factureId: f.facture_id }}
                    className="ds-ref w-28 shrink-0 font-semibold hover:underline"
                  >
                    {formatDocumentReference(f.reference)}
                  </Link>
                  <span className="min-w-0 flex-1 truncate">
                    <ClientLink clientId={f.client_id} nom={f.client_nom} />
                  </span>
                  <span className="hidden w-24 text-muted-foreground sm:block">{formatDate(f.date_facture)}</span>
                  <span className="w-32 text-right font-medium tabular-nums">
                    {formatFCFA(Number(f.montant_total))}
                  </span>
                  <span className="hidden w-24 justify-end sm:flex">
                    <StatusPill tone={FACTURE_STATUT_TONE[f.statut] ?? "neutral"}>
                      {STATUT_FACTURE_LABEL[f.statut]?.label ?? f.statut}
                    </StatusPill>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {canSeeCA && (
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-base">Meilleurs clients</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {top.isLoading ? (
              <Rows />
            ) : clients.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Aucune vente sur la période.</p>
            ) : (
              <ul className="space-y-4">
                {clients.map((c) => (
                  <li key={c.client_id} className="text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate">
                        <ClientLink clientId={c.client_id} nom={c.client_nom} />
                      </span>
                      <span className="shrink-0 font-medium tabular-nums">{formatFCFA(Number(c.ca))}</span>
                    </div>
                    <span className="mt-1.5 block h-1 w-full overflow-hidden rounded-full bg-muted">
                      <span
                        className="dash-bar block h-full rounded-full bg-primary"
                        style={{ width: `${((Number(c.ca) || 0) / maxCa) * 100}%` }}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
