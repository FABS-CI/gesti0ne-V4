import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Boxes,
  Search,
  AlertTriangle,
  Sliders,
  Eye,
  Download,
  ArrowDown,
  ArrowUp,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { listStockProduits } from "@/lib/stock-api";
import { usePermissions } from "@/hooks/use-permissions";

import { exportCsv } from "@/lib/export-csv";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { formatFCFA } from "@/lib/format";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResponsiveTable } from "@/components/layout/ResponsiveTable";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/stock/")({
  component: StockPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

type EtatStock = { label: string; color: string };
function etatDuStock(stock: number, seuil: number): EtatStock {
  if (stock <= 0) return { label: "Rupture", color: "#EF4444" };
  if (seuil > 0 && stock <= seuil) return { label: "Seuil atteint", color: "#F97316" };
  if (seuil > 0 && stock <= seuil * 1.5) return { label: "Stock faible", color: "#EAB308" };
  return { label: "Stock normal", color: "#10B981" };
}

function StockPage() {
  const [search, setSearch] = useState("");
  const q = useDebouncedValue(search, 300);
  const { has } = usePermissions();
  const canEditStock = has("stock.modifier");

  const { data: produits = [], isLoading } = useQuery({
    queryKey: ["stock", q],
    queryFn: () => listStockProduits(q),
  });

  const { data: kpis } = useQuery({
    queryKey: ["stock-kpis-30j"],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data, error } = await supabase
        .from("stock_mouvements")
        .select("type, quantite")
        .gte("created_at", since.toISOString());
      if (error) throw error;
      const acc = { entrees: 0, sorties: 0, ajustements: 0 };
      for (const m of data ?? []) {
        const t = (m as { type: string; quantite: number }).type;
        const q = Number((m as { type: string; quantite: number }).quantite ?? 0);
        if (t === "entree") acc.entrees += q;
        else if (t === "sortie") acc.sorties += q;
        else if (t === "ajustement") acc.ajustements += q;
      }
      return acc;
    },
  });

  const enAlerte = produits.filter((p) => p.stock <= p.seuil_alerte).length;

  function exportData() {
    const totalQte = produits.reduce((s, p) => s + (Number(p.stock) || 0), 0);
    const totalValeur = produits.reduce(
      (s, p) => s + (Number(p.stock) || 0) * (Number(p.prix_vente) || 0),
      0,
    );
    const categories = new Set(produits.map((p) => p.categorie).filter(Boolean));
    const rupture = produits.filter((p) => (p.stock ?? 0) <= 0).length;
    exportCsv(
      `stock_fabs_${new Date().toISOString().slice(0, 10)}`,
      ["N°", "Référence", "Désignation", "Niveau", "Stock", "Valeur vente", "Seuil", "Prix vente"],
      produits.map((p, i) => [
        String(i + 1),
        p.reference,
        p.titre,
        p.niveau ?? "",
        p.stock,
        formatFCFA((p.stock ?? 0) * (p.prix_vente ?? 0), false),
        p.seuil_alerte,
        p.prix_vente,
      ]),
      {
        pageTitle: "ÉTAT DU STOCK",
        columnStyles: {
          0: { cellWidth: 12, halign: "center", fontStyle: "bold" },
          1: {
            cellWidth: 32,
            fontStyle: "bold",
            overflow: "visible",
            cellPadding: { top: 2.5, right: 2, bottom: 2.5, left: 2 },
          },
          2: { cellWidth: "auto" },
          3: { cellWidth: 20, halign: "center" },
          4: { cellWidth: 18, halign: "right", fontStyle: "bold" },
          5: { cellWidth: 28, halign: "right", fontStyle: "bold" },
          6: { cellWidth: 18, halign: "right" },
          7: { cellWidth: 22, halign: "right" },
        },
        summary: [
          { label: "Nombre total de références", value: String(produits.length) },
          { label: "Quantité totale en stock", value: `${totalQte} ex.` },
          { label: "Valeur totale du stock (Prix de vente)", value: formatFCFA(totalValeur) },
          { label: "Catégories représentées", value: String(categories.size) },
          { label: "Produits en rupture", value: String(rupture) },
          { label: "Produits en alerte", value: String(enAlerte) },
        ],
      },
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Boxes className="h-6 w-6 text-[#10B981]" />
          <div>
            <h1 className="text-2xl font-bold">Stock</h1>
            <p className="text-sm text-muted-foreground">
              {produits.length} produit(s) · {enAlerte} en alerte
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={exportData}>
          <Download className="mr-2 h-4 w-4" /> Export PDF
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowDown className="h-4 w-4 text-[#10B981]" /> Entrées (30j)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-[#10B981]">
            {kpis?.entrees ?? 0}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowUp className="h-4 w-4 text-[#EF4444]" /> Sorties (30j)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-[#EF4444]">
            {kpis?.sorties ?? 0}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 text-[#F97316]" /> Ajustements (30j)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-[#F97316]">
            {kpis?.ajustements ?? 0}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4 text-[#EF4444]" /> Produits en alerte
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{enAlerte}</CardContent>
        </Card>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Rechercher un produit…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="rounded-lg border bg-card">
        <ResponsiveTable stickyFirstCol>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Référence</TableHead>
                <TableHead>Produit</TableHead>
                <TableHead>Niveau</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Valeur vente</TableHead>
                <TableHead className="text-right">Seuil</TableHead>
                <TableHead>État</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    Chargement…
                  </TableCell>
                </TableRow>
              ) : produits.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    Aucun produit
                  </TableCell>
                </TableRow>
              ) : (
                produits.map((p) => {
                  const etat = etatDuStock(p.stock, p.seuil_alerte);
                  return (
                    <TableRow key={p.produit_id} className="hover:bg-[#10B981]/10">
                      <TableCell className="font-medium">{p.reference}</TableCell>
                      <TableCell>{p.titre}</TableCell>
                      <TableCell className="text-muted-foreground">{p.niveau ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{p.categorie ?? "—"}</TableCell>
                      <TableCell className="text-right font-bold">{p.stock}</TableCell>
                      <TableCell className="text-right font-medium text-emerald-600">
                        {formatFCFA((p.stock ?? 0) * (p.prix_vente ?? 0))}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {p.seuil_alerte}
                      </TableCell>
                      <TableCell>
                        <Badge style={{ background: etat.color, color: "#fff" }}>
                          {etat.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {canEditStock && (
                            <Button asChild variant="ghost" size="sm">
                              <Link
                                to="/stock/$produitId/mouvements"
                                params={{ produitId: p.produit_id }}
                              >
                                <Sliders className="mr-1 h-4 w-4" /> Ajustement manuel
                              </Link>
                            </Button>
                          )}
                          <Button asChild variant="ghost" size="sm">
                            <Link to="/produits/$produitId" params={{ produitId: p.produit_id }}>
                              <Eye className="mr-1 h-4 w-4" /> Consulter
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </ResponsiveTable>
      </div>
    </div>
  );
}
