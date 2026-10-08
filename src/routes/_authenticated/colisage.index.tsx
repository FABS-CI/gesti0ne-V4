import { formatDocumentReference } from "@/lib/document-reference";
import { ClientLink } from "@/components/common/ClientLink";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigation, Package, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResponsiveTable } from "@/components/layout/ResponsiveTable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listBonsLivraisonAColiser, STATUTS_BL, STATUT_BL_LABEL } from "@/lib/colisage-api";
import { useExerciceConsulteId } from "@/contexts/ExerciceContext";

import { authRouteHead } from "@/lib/route-head";
import { FilterBadges, type FilterBadge } from "@/components/common/FilterBadges";
import { EmptyState } from "@/components/common/EmptyState";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
export const Route = createFileRoute("/_authenticated/colisage/")({
  head: () => authRouteHead("Colisage"),
  component: ColisageListPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function frDate(d: string | null | undefined) {
  return d ? new Date(d).toLocaleDateString("fr-FR") : "—";
}

function ColisageListPage() {
  const [q, setQ] = useState("");
  const [statut, setStatut] = useState<string>("a_traiter");
  const [printingBlId, setPrintingBlId] = useState<string | null>(null);
  const exerciceId = useExerciceConsulteId();

  const { data, isLoading } = useQuery({
    queryKey: ["colisage-bl-list", exerciceId],
    enabled: !!exerciceId,
    queryFn: () => listBonsLivraisonAColiser(exerciceId),
  });

  const filtered = useMemo(() => {
    const rows = (data ?? []).filter((r) => r.statut !== "colisage_supprime");
    const priority: Record<string, number> = {
      brouillon: 0,
      a_preparer: 1,
      preparee: 2,
      colisage_en_cours: 3,
      colisage_termine: 4,
      livre: 5,
      expedie: 6,
      annule: 7,
    };
    const ql = q.trim().toLowerCase();
    const out = rows.filter((r) => {
      if (statut === "a_traiter") {
        if (!["brouillon", "a_preparer", "colisage_en_cours"].includes(r.statut)) return false;
      } else if (statut !== "all" && r.statut !== statut) return false;
      if (!ql) return true;
      return [r.reference, r.client_nom, r.etablissement, r.representant_nom, r.ville]
        .filter(Boolean)
        .some((x) => (x as string).toLowerCase().includes(ql));
    });
    out.sort(
      (a, b) =>
        (priority[a.statut] ?? 99) - (priority[b.statut] ?? 99) ||
        (b.date_emission ?? "").localeCompare(a.date_emission ?? ""),
    );
    return out;
  }, [data, q, statut]);

  const handlePrintEtiquettes = async (blId: string) => {
    try {
      setPrintingBlId(blId);
      const [bl, colis] = await Promise.all([
        import("@/lib/colisage-api").then((m) => m.getBLDetail(blId)),
        import("@/lib/colisage-api").then((m) => m.listColisForBL(blId)),
      ]);

      if (!bl) throw new Error("Bon de livraison introuvable");
      if (!colis || colis.length === 0) {
        throw new Error("Aucun colisage trouvé pour ce bon de livraison");
      }

      const { triggerAutoPrintEtiquettes } = await import("@/lib/colisage-print-utils");
      await triggerAutoPrintEtiquettes(colis, bl);
    } catch (error: any) {
      console.error("[handlePrintEtiquettes]", error);
      const { toast } = await import("sonner");
      toast.error(error.message || "Erreur lors de l'impression des étiquettes");
    } finally {
      setPrintingBlId(null);
    }
  };

  const statutLabel =
    statut === "a_traiter"
      ? "À traiter"
      : statut === "all"
        ? "Tous"
        : (STATUT_BL_LABEL[statut]?.label ?? statut);
  const hasActiveFilters = !!q.trim() || statut !== "a_traiter";
  const resetAllFilters = () => {
    setQ("");
    setStatut("a_traiter");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <Package className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="ds-page-title">Colisage</h1>
          <p className="text-sm text-muted-foreground">
            Préparation des cartons à partir des bons de livraison
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/tournees/nouvelle" search={{ preselect: "all" }}>
            <Navigation className="h-4 w-4 mr-1.5" /> Créer une tournée
          </Link>
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher (n°, établissement, représentant, ville)"
              className="pl-8"
            />
          </div>
          <Select value={statut} onValueChange={setStatut}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="a_traiter">À traiter (brouillon + à préparer)</SelectItem>
              <SelectItem value="all">Tous</SelectItem>
              {STATUTS_BL.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <FilterBadges
        badges={[
          ...(q.trim()
            ? [{ key: "q", label: `Recherche : ${q}`, onClear: () => setQ("") } as FilterBadge]
            : []),
          ...(statut !== "a_traiter"
            ? [{ key: "statut", label: `Statut : ${statutLabel}`, onClear: () => setStatut("a_traiter") } as FilterBadge]
            : []),
        ]}
        onResetAll={resetAllFilters}
      />

      <Card>
        {isLoading ? (
          <div className="p-4 space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <ResponsiveTable stickyFirstCol>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° BL</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Établissement</TableHead>
                  <TableHead>Ville</TableHead>
                  <TableHead className="text-right">Articles</TableHead>
                  <TableHead className="text-right">Qté</TableHead>
                  <TableHead>État</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-6">
                      <EmptyState
                        icon={Package}
                        title={
                          hasActiveFilters
                            ? "Aucun bon de livraison ne correspond aux filtres appliqués."
                            : "Aucun bon de livraison à coliser."
                        }
                        onReset={hasActiveFilters ? resetAllFilters : undefined}
                        className="border-none"
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => {
                    const st = STATUT_BL_LABEL[r.statut];
                    return (
                      <TableRow key={r.bl_id}>
                        <TableCell className="font-mono text-xs">{formatDocumentReference(r.reference)}</TableCell>
                        <TableCell>{frDate(r.date_emission)}</TableCell>
                        <TableCell><ClientLink clientId={r.client_id} nom={r.client_nom} /></TableCell>
                        <TableCell>{r.etablissement ?? "—"}</TableCell>
                        <TableCell>{r.ville ?? "—"}</TableCell>
                        <TableCell className="text-right">{r.nb_articles}</TableCell>
                        <TableCell className="text-right">{r.total_quantite}</TableCell>
                        <TableCell>
                          {st ? (
                            <Badge style={{ backgroundColor: st.color }} className="text-white">
                              {st.label}
                            </Badge>
                          ) : (
                            <Badge variant="outline">{r.statut}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button asChild size="sm" variant="outline">
                              <Link to="/colisage/$blId" params={{ blId: r.bl_id }}>
                                Ouvrir
                              </Link>
                            </Button>

                            {r.statut === "colisage_termine" && (
                              <Button
                                size="sm"
                                onClick={() => handlePrintEtiquettes(r.bl_id)}
                                disabled={printingBlId === r.bl_id}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                              >
                                {printingBlId === r.bl_id ? (
                                  <span className="flex items-center gap-1.5">
                                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                    ...
                                  </span>
                                ) : (
                                  "🖨 Imprimer les étiquettes"
                                )}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </ResponsiveTable>
        )}
      </Card>
    </div>
  );
}
