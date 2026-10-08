import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  ArrowLeft,
  Building2,
  Calendar,
  FileText,
  Pencil,
  Printer,
  ScanEye,
  Tag,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { getAchat, getAchatLignes, STATUT_ACHAT_LABEL } from "@/lib/achats-api";
import { formatDate, formatFCFA } from "@/lib/format";
import { generateApprovisionnementPDF } from "@/lib/pdf/fabsTemplates";
import { printCached, viewCached } from "@/lib/pdf/actions";
import { pdfCacheKey } from "@/lib/pdf/pdfCache";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { friendlyError } from "@/lib/friendly-error";
import { ProductCoverThumb } from "@/components/produits/ProductCoverThumb";

export const Route = createFileRoute("/_authenticated/achats/$achatId")({
  component: AchatDetailPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function frDate(d: string | null | undefined) {
  return d ? formatDate(d) : "—";
}

function AchatDetailPage() {
  const { achatId } = Route.useParams();
  const { data: achat, isLoading } = useQuery({
    queryKey: ["achat", achatId],
    queryFn: () => getAchat(achatId),
  });
  const { data: lignes = [] } = useQuery({
    queryKey: ["achat-lignes", achatId],
    queryFn: () => getAchatLignes(achatId),
  });

  const buildBlob = async () => {
    if (!achat) throw new Error("Approvisionnement introuvable");

    // Calcul des totaux à partir des lignes pour garantir la cohérence (Audit point 7 & 10)
    const totalBrut = lignes.reduce((s, l) => s + Number(l.quantite) * Number(l.prix_unitaire), 0);
    const totalRemiseLignes = lignes.reduce((s, l) => {
      const q = Number(l.quantite);
      const p = Number(l.prix_unitaire);
      const r = Number(l.remise_pct ?? 0);
      return s + (q * p * r) / 100;
    }, 0);

    // Calcul du pourcentage moyen de remise (si homogène)
    const remisePctMoyenne = totalBrut > 0 ? (totalRemiseLignes / totalBrut) * 100 : 0;

    return generateApprovisionnementPDF({
      id: achat.achat_id,
      br_id: achat.achat_id,
      reference: achat.reference,
      date: achat.date_achat,
      clientNom: achat.fournisseurs?.raison_sociale ?? "—",
      codeClient: achat.fournisseurs?.reference ?? achat.reference_fournisseur ?? undefined,
      clientTel: achat.fournisseurs?.telephone ?? undefined,
      emailClient: achat.fournisseurs?.email ?? undefined,
      adresseClient: achat.fournisseurs?.adresse ?? undefined,
      villeClient: achat.fournisseurs?.ville ?? undefined,
      representant: achat.fournisseurs?.representant ?? undefined,
      modePaiement: achat.reference_fournisseur ? `Réf. Fournisseur: ${achat.reference_fournisseur}` : undefined,
      lignes: lignes.map((l) => ({
        codeArticle: l.reference_produit || (l as any).produits?.reference || undefined,
        reference: l.designation,
        qte: Number(l.quantite),
        prixUnitaire: Number(l.prix_unitaire),
        remisePct: Number(l.remise_pct ?? 0),
        montant: Number(l.total_ligne),
      })),
      totalVente: totalBrut,
      remiseLigneTotal: totalRemiseLignes,
      remisePct: remisePctMoyenne,
      remiseGlobalePct: 0,
      remiseGlobale: 0,
      montantHT: totalBrut - totalRemiseLignes,
      totalTTC: totalBrut - totalRemiseLignes,
      montant: Number(achat.montant),
      notes: achat.notes ?? undefined,
    });
  };
  const cacheKey = pdfCacheKey("BA", achat?.reference ?? achatId, achat?.updated_at);

  const handleView = async () => {
    try {
      await viewCached(cacheKey, buildBlob);
    } catch (e) {
      toast.error(friendlyError(e, "Erreur aperçu"));
    }
  };
  const handlePrint = async () => {
    try {
      await printCached(cacheKey, buildBlob);
    } catch (e) {
      toast.error(friendlyError(e, "Erreur impression"));
    }
  };

  // Auto-print si ?print=1 (déclenche la génération PDF ERP)
  useEffect(() => {
    if (typeof window === "undefined" || !achat) return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("print") === "1") {
      const t = setTimeout(() => {
        void handlePrint();
      }, 400);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [achat]);

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!achat)
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Approvisionnement introuvable.</p>
        <Button asChild variant="outline">
          <Link to="/achats">Retour</Link>
        </Button>
      </div>
    );

  const st = STATUT_ACHAT_LABEL[achat.statut];
  const qteTotale = lignes.reduce((s, l) => s + l.quantite, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <Button aria-label="Retour" asChild variant="ghost" size="icon">
            <Link to="/achats">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="ds-page-title">Approvisionnement {achat.reference}</h1>
            <p className="text-sm text-muted-foreground">{achat.libelle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {st && (
            <Badge style={{ backgroundColor: st.color }} className="text-white">
              {st.label}
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={handleView}>
            <ScanEye className="h-4 w-4 mr-2" /> Aperçu PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" /> Imprimer
          </Button>
          <Button asChild size="sm">
            <Link to="/achats/nouveau" search={{ edit: achatId }}>
              <Pencil className="h-4 w-4 mr-2" /> Modifier
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <Tag className="h-4 w-4" /> Montant total
            </CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-bold text-primary">
            {formatFCFA(achat.montant)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <Building2 className="h-4 w-4" /> Fournisseur
            </CardTitle>
          </CardHeader>
          <CardContent className="font-medium">
            {achat.fournisseurs?.raison_sociale ?? "—"}
            {achat.reference_fournisseur && (
              <p className="text-xs text-muted-foreground mt-1">
                Réf. fournisseur : {achat.reference_fournisseur}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" /> Date
            </CardTitle>
          </CardHeader>
          <CardContent className="font-medium">{frDate(achat.date_achat)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" /> Enregistré par
            </CardTitle>
          </CardHeader>
          <CardContent className="font-medium">
            {achat.created_by_nom ?? "—"}
            <p className="text-xs text-muted-foreground mt-1">{frDate(achat.created_at)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Produits livrés ({lignes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {lignes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune ligne enregistrée.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14"></TableHead>
                  <TableHead>Désignation</TableHead>
                  <TableHead>Référence</TableHead>
                  <TableHead className="text-right">Qté</TableHead>
                  <TableHead className="text-right">Prix unit. (FCFA)</TableHead>
                  <TableHead className="text-right">Remise (%)</TableHead>
                  <TableHead className="text-right">Total (FCFA)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lignes.map((l) => (
                  <TableRow key={l.ligne_id}>
                    <TableCell className="py-1">
                      <ProductCoverThumb
                        produit={l.produits ? { ...l, ...l.produits, titre: l.designation } : { ...l, titre: l.designation }}
                        size="xs"
                        className="shadow-sm"
                      />
                    </TableCell>
                    <TableCell className="font-medium">{l.designation}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {l.reference_produit ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">{l.quantite}</TableCell>
                    <TableCell className="text-right">
                      {formatFCFA(Number(l.prix_unitaire))}
                    </TableCell>
                    <TableCell className="text-right">
                      {Number(l.remise_pct ?? 0) > 0
                        ? `${Number(l.remise_pct).toFixed(2)} %`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatFCFA(Number(l.total_ligne))}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={3} className="text-right font-semibold">
                    Totaux
                  </TableCell>
                  <TableCell className="text-right font-semibold">{qteTotale}</TableCell>
                  <TableCell />
                  <TableCell />
                  <TableCell className="text-right font-bold">
                    {formatFCFA(achat.montant)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {achat.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              <FileText className="inline h-4 w-4 mr-1" /> Observations
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap">
            {achat.notes}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
