import { formatDocumentReference } from "@/lib/document-reference";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Calendar, FileDown, FileText, Loader2, Receipt, RefreshCw, User } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { generateUnifiedCommercialPDF } from "@/lib/pdf/unified-generator";
import { fileNameFor } from "@/lib/pdf/fabsTemplates";
import { pdfCacheKey, invalidatePdfByPrefix } from "@/lib/pdf/pdfCache";
import { viewCached, printCached, emailDoc } from "@/lib/pdf/actions";
import {
  loadProformaDocLignes,
  loadClientInfoForProforma,
  loadProformaTotals,
} from "@/lib/pdf/enrich-lignes";
import { usePdfDownload } from "@/hooks/use-pdf-download";

import { supabase } from "@/integrations/supabase/client";
import { formatFCFA } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/proformas/$proformaId")({
  component: ProformaDetailPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function frDate(d: string | null | undefined) {
  return d ? new Date(d).toLocaleDateString("fr-FR") : "—";
}

async function getProforma(id: string) {
  const { data, error } = await supabase
    .from("proformas")
    .select("*")
    .eq("proforma_id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getProformaLignes(id: string) {
  const { data, error } = await supabase
    .from("proforma_lignes")
    .select("*")
    .eq("proforma_id", id)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function getCommandeLiee(commandeId: string | null) {
  if (!commandeId) return null;
  const { data, error } = await supabase
    .from("commandes")
    .select("commande_id, reference, numero, adresse, ville, representant_nom, telephone, client_id")
    .eq("commande_id", commandeId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getClientConditions(clientId: string | null) {
  if (!clientId) return null;
  const { data, error } = await supabase
    .from("clients")
    .select("client_id, nom, adresse, ville, commune, telephone, email, representant, mode_paiement, delai_paiement")
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Ligne d'information reprise de la commande / du client, avec badge si vide. */
function InfoLigne({ label, value }: { label: string; value?: string | null }) {
  const vide = !value || String(value).trim() === "";
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b py-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      {vide ? (
        <Badge variant="destructive" className="animate-pulse">Champ manquant</Badge>
      ) : (
        <span className="text-sm font-medium">{value}</span>
      )}
    </div>
  );
}

function ProformaDetailPage() {
  const { proformaId } = Route.useParams();
  const { data: proforma, isLoading } = useQuery({
    queryKey: ["proforma", proformaId],
    queryFn: () => getProforma(proformaId),
  });
  const pdf = usePdfDownload();
  const { data: lignes = [] } = useQuery({
    queryKey: ["proforma-lignes", proformaId],
    queryFn: () => getProformaLignes(proformaId),
  });

  const { data: commande } = useQuery({
    queryKey: ["proforma-commande", proforma?.commande_id],
    queryFn: () => getCommandeLiee(proforma?.commande_id ?? null),
    enabled: !!proforma?.commande_id,
  });
  const { data: client } = useQuery({
    queryKey: ["proforma-client", proforma?.client_id],
    queryFn: () => getClientConditions(proforma?.client_id ?? null),
    enabled: !!proforma?.client_id,
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!proforma)
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Proforma introuvable.</p>
        <Button asChild variant="outline">
          <Link to="/proformas">Retour</Link>
        </Button>
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link to="/proformas">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold">Proforma {formatDocumentReference(proforma.reference)}</h1>
            <p className="text-sm text-muted-foreground">
              {proforma.client_nom ?? "Client non renseigné"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              try {
                if (!proforma.reference || !proforma.date_proforma) {
                  throw new Error("Proforma incomplète : référence ou date absente");
                }
                invalidatePdfByPrefix(`PF:${formatDocumentReference(proforma.reference)}:`);
                const [lignes, clientInfo, totals] = await Promise.all([
                  loadProformaDocLignes(proformaId),
                  loadClientInfoForProforma(proformaId),
                  loadProformaTotals(proformaId),
                ]);
                const blob = await generateUnifiedCommercialPDF("Proforma", {
                  id: proformaId,
                  proforma_id: proformaId,
                  reference: proforma.reference,
                  date: proforma.date_proforma,
                  clientNom: proforma.client_nom,
                  totalVente: Number(proforma.montant_total),
                  montantHT: Number(proforma.montant_total),
                  lignes,
                  ...clientInfo,
                  ...totals,
                });
                const url = URL.createObjectURL(blob);
                window.open(url, "_blank");
                setTimeout(() => URL.revokeObjectURL(url), 60_000);
                toast.success("Document régénéré avec le nouveau modèle");
              } catch {
                toast.error("Erreur lors de la régénération");
              }
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Régénérer le PDF
          </Button>
          {(() => {
            const st = pdf.getState(proformaId);
            return (
              <Button
                size="sm"
                variant="outline"
                disabled={st.loading}
                onClick={() =>
                  pdf.download(
                    proformaId,
                    async () => {
                      if (!proforma.reference || !proforma.date_proforma) {
                        throw new Error("Proforma incomplète : référence ou date absente");
                      }
                      const [lignes, clientInfo, totals] = await Promise.all([
                        loadProformaDocLignes(proformaId),
                        loadClientInfoForProforma(proformaId),
                        loadProformaTotals(proformaId),
                      ]);
                      return generateUnifiedCommercialPDF("Proforma", {
                        id: proformaId,
                        proforma_id: proformaId,
                        reference: proforma.reference,
                        date: proforma.date_proforma,
                        clientNom: proforma.client_nom,
                        totalVente: Number(proforma.montant_total),
                        montantHT: Number(proforma.montant_total),
                        lignes,
                        ...clientInfo,
                        ...totals,
                      });
                    },
                    fileNameFor(proforma.reference ?? proformaId, proforma.client_nom),
                    {
                      type: "PF",
                      data: {
                        ...proforma,
                        clientNom: proforma.client_nom,
                        date: proforma.date_proforma,
                      } as any,
                    }
                  )
                }
              >
                {st.loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="mr-2 h-4 w-4" />
                )}
                {st.loading ? "Génération…" : "Télécharger PDF"}
              </Button>
            );
          })()}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" /> Client
            </CardTitle>
          </CardHeader>
          <CardContent className="font-medium">{proforma.client_nom ?? "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" /> Date
            </CardTitle>
          </CardHeader>
          <CardContent className="font-medium">{frDate(proforma.date_proforma)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" /> Validité
            </CardTitle>
          </CardHeader>
          <CardContent className="font-medium">{frDate(proforma.date_validite)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <Receipt className="h-4 w-4" /> Total
            </CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-bold text-primary">
            {formatFCFA(proforma.montant_total)}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Informations reprises {commande ? `de la commande ${commande.reference ?? commande.numero ?? ""}` : "du client"}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-x-8 sm:grid-cols-2">
          <InfoLigne
            label="Adresse de livraison"
            value={
              [commande?.adresse ?? client?.adresse, commande?.ville ?? client?.ville]
                .filter(Boolean)
                .join(" — ") || null
            }
          />
          <InfoLigne
            label="Contact"
            value={
              [commande?.representant_nom ?? client?.representant, commande?.telephone ?? client?.telephone]
                .filter(Boolean)
                .join(" — ") || null
            }
          />
          <InfoLigne label="Email" value={client?.email} />
          <InfoLigne
            label="Conditions de paiement"
            value={
              client?.mode_paiement
                ? `${client.mode_paiement}${client.delai_paiement ? ` — ${client.delai_paiement} j` : ""}`
                : null
            }
          />
          <InfoLigne label="Commande liée" value={commande?.reference ?? commande?.numero ?? null} />
          <InfoLigne label="Date de validité" value={proforma.date_validite ? frDate(proforma.date_validite) : null} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lignes de proforma</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Désignation</TableHead>
                <TableHead className="text-right">Remise (%)</TableHead>
                <TableHead className="text-right">Qté</TableHead>
                <TableHead className="text-right">P.U.</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lignes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Aucune ligne
                  </TableCell>
                </TableRow>
              ) : (
                lignes.map((l) => (
                  <TableRow key={l.ligne_id}>
                    <TableCell>{l.designation}</TableCell>
                    <TableCell className="text-right text-destructive">
                      {Number(l.quantite ?? 0) * Number(l.prix_unitaire ?? 0) > 0 && l.total_ligne != null
                        ? `${Math.max(0, (1 - Number(l.total_ligne) / (Number(l.quantite) * Number(l.prix_unitaire))) * 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">{l.quantite}</TableCell>
                    <TableCell className="text-right">{formatFCFA(l.prix_unitaire)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatFCFA(l.total_ligne)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {proforma.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">
            {proforma.notes}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
