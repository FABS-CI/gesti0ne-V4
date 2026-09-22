import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Receipt, Truck, RotateCcw, Search, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { formatFCFA } from "@/lib/format";
import {
  generateUnifiedCommercialPDF,
  generateUnifiedStatementPDF,
} from "@/lib/pdf/unified-generator";
import {
  fileNameFor,
  type DocBase,
} from "@/lib/pdf/fabsTemplates";
import {
  loadFactureDocLignes,
  loadProformaDocLignes,
  loadCommandeDocLignes,
  loadClientInfoForFacture,
  loadClientInfoForProforma,
  loadClientInfoForBL,
  loadClientInfoForBR,
  loadCommandeTotals,
  loadFactureTotals,
  loadProformaTotals,
} from "@/lib/pdf/enrich-lignes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PdfActions } from "@/components/pdf/PdfActions";
import type { FabsDocCode } from "@/lib/pdf/docTypeConfig";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/centre-documents")({
  component: CentreDocumentsPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

type DocKind = "factures" | "proformas" | "bons_livraison" | "bons_retour";

const TABS: { key: DocKind; label: string; icon: typeof FileText; color: string }[] = [
  { key: "factures", label: "Factures", icon: Receipt, color: "#3B82F6" },
  { key: "proformas", label: "Proformas", icon: FileText, color: "#8B5CF6" },
  { key: "bons_livraison", label: "Bons de livraison", icon: Truck, color: "#10B981" },
  { key: "bons_retour", label: "Bons de retour", icon: RotateCcw, color: "#F97316" },
];

type Row = {
  id: string;
  reference: string;
  date: string | null;
  client: string;
  montant: number | null;
  statut: string | null;
  /** updated_at ou date — sert de version pour invalider le cache PDF. */
  version: string | null;
};

async function fetchRows(kind: DocKind): Promise<Row[]> {
  if (kind === "factures") {
    const { data, error } = await supabase
      .from("factures")
      .select("facture_id, reference, date_facture, client_nom, montant_total, statut, updated_at")
      .order("date_facture", { ascending: false })
      .limit(200);
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.facture_id,
      reference: r.reference,
      date: r.date_facture,
      client: r.client_nom ?? "—",
      montant: r.montant_total,
      statut: r.statut,
      version: (r as { updated_at?: string }).updated_at ?? r.date_facture,
    }));
  }
  if (kind === "proformas") {
    const { data, error } = await supabase
      .from("proformas")
      .select(
        "proforma_id, reference, date_proforma, client_nom, montant_total, statut, updated_at",
      )
      .order("date_proforma", { ascending: false })
      .limit(200);
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.proforma_id,
      reference: r.reference,
      date: r.date_proforma,
      client: r.client_nom ?? "—",
      montant: r.montant_total,
      statut: r.statut,
      version: (r as { updated_at?: string }).updated_at ?? r.date_proforma,
    }));
  }
  if (kind === "bons_livraison") {
    const { data, error } = await supabase
      .from("bons_livraison")
      .select("bl_id, reference, date_livraison, client_nom, montant, statut, updated_at")
      .order("date_livraison", { ascending: false })
      .limit(200);
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.bl_id,
      reference: r.reference,
      date: r.date_livraison,
      client: r.client_nom ?? "—",
      montant: r.montant,
      statut: r.statut,
      version: (r as { updated_at?: string }).updated_at ?? r.date_livraison,
    }));
  }
  const { data, error } = await supabase
    .from("bons_retour")
    .select("br_id, reference, date_retour, motif, montant, statut, updated_at")
    .order("date_retour", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.br_id,
    reference: r.reference,
    date: r.date_retour,
    client: r.motif ?? "—",
    montant: r.montant,
    statut: r.statut,
    version: (r as { updated_at?: string }).updated_at ?? r.date_retour,
  }));
}

function buildDoc(row: Row): DocBase {
  return {
    id: row.id,
    reference: row.reference,
    date: row.date ?? new Date().toISOString().slice(0, 10),
    clientNom: row.client,
    totalTTC: row.montant ?? undefined,
    lignes: [],
  };
}

const KIND_TO_TYPE: Record<DocKind, FabsDocCode> = {
  factures: "FAC",
  proformas: "PRO",
  bons_livraison: "BL",
  bons_retour: "RET",
};

function makeGenerator(kind: DocKind, row: Row): () => Promise<Blob> {
  return async () => {
    const doc = buildDoc(row);
    if (kind === "factures") {
      const [lignes, info, totals] = await Promise.all([
        loadFactureDocLignes(row.id),
        loadClientInfoForFacture(row.id),
        loadFactureTotals(row.id),
      ]);
      doc.lignes = lignes;
      return generateUnifiedCommercialPDF("Facture", {
        ...doc,
        ...info,
        ...totals,
        clientNom: info.clientNom ?? doc.clientNom,
      });
    }
    if (kind === "proformas") {
      const [lignes, info, totals] = await Promise.all([
        loadProformaDocLignes(row.id),
        loadClientInfoForProforma(row.id),
        loadProformaTotals(row.id),
      ]);
      doc.lignes = lignes;
      return generateUnifiedCommercialPDF("Proforma", {
        ...doc,
        ...info,
        ...totals,
        clientNom: info.clientNom ?? doc.clientNom,
      });
    }
    if (kind === "bons_livraison") {
      const { data: bl } = await supabase
        .from("bons_livraison")
        .select("commande_id")
        .eq("bl_id", row.id)
        .maybeSingle();
      const [lignes, info, totals] = await Promise.all([
        bl?.commande_id ? loadCommandeDocLignes(bl.commande_id) : Promise.resolve([]),
        loadClientInfoForBL(row.id),
        bl?.commande_id ? loadCommandeTotals(bl.commande_id) : Promise.resolve({}),
      ]);
      doc.lignes = lignes;
      return generateUnifiedCommercialPDF("Bon de Livraison", {
        ...doc,
        ...info,
        ...totals,
        clientNom: info.clientNom ?? doc.clientNom,
      });
    }
    const { data: br } = await supabase
      .from("bons_retour")
      .select("facture_id")
      .eq("br_id", row.id)
      .maybeSingle();
    const [lignes, info, totals] = await Promise.all([
      br?.facture_id ? loadFactureDocLignes(br.facture_id) : Promise.resolve([]),
      loadClientInfoForBR(row.id),
      br?.facture_id ? loadFactureTotals(br.facture_id) : Promise.resolve({}),
    ]);
    doc.lignes = lignes;
      return generateUnifiedCommercialPDF("Bon de Retour", {
        ...doc,
        ...info,
        ...totals,
        clientNom: info.clientNom ?? doc.clientNom,
      });
  };
}

function CentreDocumentsPage() {
  const [tab, setTab] = useState<DocKind>("factures");
  const [search, setSearch] = useState("");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <FileText className="h-6 w-6" /> Centre de documents
        </h1>
        <p className="text-sm text-muted-foreground">
          Recherchez et téléchargez vos documents PDF (factures, proformas, BL, retours).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documents émis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Référence ou client…"
              className="pl-8"
            />
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as DocKind)}>
            <TabsList>
              {TABS.map((t) => {
                const Icon = t.icon;
                return (
                  <TabsTrigger key={t.key} value={t.key} className="gap-2">
                    <Icon className="h-4 w-4" style={{ color: t.color }} />
                    {t.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
            {TABS.map((t) => (
              <TabsContent key={t.key} value={t.key} className="mt-4">
                <DocList kind={t.key} search={search} />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function DocList({ kind, search }: { kind: DocKind; search: string }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["centre-docs", kind],
    queryFn: () => fetchRows(kind),
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return data;
    return data.filter(
      (r) => r.reference.toLowerCase().includes(s) || (r.client ?? "").toLowerCase().includes(s),
    );
  }, [data, search]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Chargement…
      </div>
    );
  }

  if (filtered.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Aucun document.</p>;
  }

  return (
    <div className="rounded-md border overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Référence</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Client</TableHead>
            <TableHead className="text-right">Montant</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-right">PDF</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-mono text-xs">{row.reference}</TableCell>
              <TableCell>
                {row.date ? new Date(row.date).toLocaleDateString("fr-FR") : "—"}
              </TableCell>
              <TableCell>{row.client}</TableCell>
              <TableCell className="text-right">
                {row.montant != null ? formatFCFA(row.montant) : "—"}
              </TableCell>
              <TableCell>{row.statut && <Badge variant="outline">{row.statut}</Badge>}</TableCell>
              <TableCell className="text-right">
                <PdfActions
                  type={KIND_TO_TYPE[kind]}
                  reference={row.reference}
                  version={row.version}
                  filename={fileNameFor(row.reference, row.client)}
                  generate={makeGenerator(kind, row)}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
