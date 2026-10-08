import { formatDate } from "@/lib/format";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Gift, Plus, Search, Eye, Printer, Ban, Loader2, RotateCcw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  STATUTS_SPECIMEN,
  STATUT_SPECIMEN_LABEL,
  type Specimen,
  listSpecimens,
  getSpecimen,
  annulerSpecimen,
} from "@/lib/specimens-api";
import { Can } from "@/components/rbac/Can";
import { generateBonRemiseSpecimensPDF, downloadBlob, fileNameFor } from "@/lib/pdf/fabsTemplates";
import { describeSupabaseError } from "@/lib/rbac-api";

import { authRouteHead } from "@/lib/route-head";
import { FilterBadges, type FilterBadge } from "@/components/common/FilterBadges";
import { EmptyState } from "@/components/common/EmptyState";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
export const Route = createFileRoute("/_authenticated/specimens/")({
  head: () => authRouteHead("Spécimens"),
  component: SpecimensListPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function SpecimensListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [statut, setStatut] = useState<string>("all");
  const [ville, setVille] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [toCancel, setToCancel] = useState<Specimen | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);

  const { data: specimens = [], isLoading } = useQuery({
    queryKey: ["specimens", { q, statut, ville, dateFrom, dateTo }],
    queryFn: () =>
      listSpecimens({
        q,
        statut,
        ville: ville || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => annulerSpecimen(id),
    onSuccess: () => {
      toast.success("Spécimen annulé — stock réinjecté");
      qc.invalidateQueries({ queryKey: ["specimens"] });
      qc.invalidateQueries({ queryKey: ["produits"] });
      qc.invalidateQueries({ queryKey: ["stock"] });
      setToCancel(null);
    },
    onError: (e: Error) => {
      const d = describeSupabaseError(e);
      toast.error(d.title, { description: d.message });
    },
  });

  const handlePrint = async (s: Specimen) => {
    setPrintingId(s.specimen_id);
    try {
      const full = await getSpecimen(s.specimen_id);
      const blob = await generateBonRemiseSpecimensPDF({
        reference: full.numero,
        date: full.date_envoi,
        clientNom: full.etablissement,
        clientTel: full.telephone,
        representant: full.representant_nom,
        lignes: full.lignes.map((l) => ({
          reference: l.reference_produit ?? "",
          codeArticle: l.reference_produit ?? "",
          niveau: l.designation,
          qte: l.quantite,
        })),
      });
      downloadBlob(blob, fileNameFor(full.numero, full.etablissement));
    } catch (e) {
      const d = describeSupabaseError(e);
      toast.error(d.title, { description: d.message });
    } finally {
      setPrintingId(null);
    }
  };

  const stats = useMemo(() => {
    const enregistre = specimens.filter((s) => s.statut === "enregistre");
    return {
      total: specimens.length,
      enregistre: enregistre.length,
      annule: specimens.filter((s) => s.statut === "annule").length,
      quantite: enregistre.reduce((sum, s) => sum + (s.total_quantite || 0), 0),
    };
  }, [specimens]);

  const hasActiveFilters =
    !!q || statut !== "all" || !!ville || !!dateFrom || !!dateTo;
  const resetAllFilters = () => {
    setQ("");
    setStatut("all");
    setVille("");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Gift className="h-7 w-7 text-primary" />
          <div>
            <h1 className="ds-page-title">Gestion des Spécimens</h1>
            <p className="text-muted-foreground text-sm">
              Remises gratuites d'ouvrages aux établissements — décrémentation directe du stock
            </p>
          </div>
        </div>
        <Can permission="specimens.creer">
          <Button onClick={() => navigate({ to: "/specimens/nouveau" })}>
            <Plus className="h-4 w-4 mr-2" />
            Nouveau Spécimen
          </Button>
        </Can>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Enregistrés" value={stats.enregistre} accent="text-success" />
        <StatCard label="Annulés" value={stats.annule} accent="text-destructive" />
        <StatCard label="Quantité totale remise" value={stats.quantite} />
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Numéro, établissement, représentant, donneur, motif…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statut} onValueChange={setStatut}>
          <SelectTrigger>
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            {STATUTS_SPECIMEN.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input placeholder="Ville" value={ville} onChange={(e) => setVille(e.target.value)} />
        <div className="flex gap-2">
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </div>

      <FilterBadges
        badges={[
          ...(q ? [{ key: "q", label: `Recherche : ${q}`, onClear: () => setQ("") } as FilterBadge] : []),
          ...(statut !== "all"
            ? [{ key: "statut", label: `Statut : ${STATUT_SPECIMEN_LABEL[statut]?.label ?? statut}`, onClear: () => setStatut("all") } as FilterBadge]
            : []),
          ...(ville ? [{ key: "ville", label: `Ville : ${ville}`, onClear: () => setVille("") } as FilterBadge] : []),
          ...(dateFrom || dateTo
            ? [{ key: "periode", label: `Période : ${dateFrom || "…"} → ${dateTo || "…"}`, onClear: () => { setDateFrom(""); setDateTo(""); } } as FilterBadge]
            : []),
        ]}
        onResetAll={resetAllFilters}
      />

      <div className="rounded-md border bg-card">
        <ResponsiveTable stickyFirstCol>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numéro</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Établissement</TableHead>
                <TableHead>Représentant</TableHead>
                <TableHead>Ville</TableHead>
                <TableHead className="text-right">Produits</TableHead>
                <TableHead className="text-right">Quantité</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Gestionnaire</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    Chargement…
                  </TableCell>
                </TableRow>
              ) : specimens.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-6">
                    <EmptyState
                      variant={hasActiveFilters ? "compact" : "rich"}
                      icon={Gift}
                      title={
                        hasActiveFilters
                          ? "Aucun spécimen ne correspond aux filtres appliqués."
                          : "Aucun spécimen enregistré."
                      }
                      description={
                        hasActiveFilters
                          ? undefined
                          : "Enregistrez les échantillons remis aux prescripteurs pour tracer coûts marketing et retombées commerciales."
                      }
                      onReset={hasActiveFilters ? resetAllFilters : undefined}
                      className="border-none"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                specimens.map((s) => {
                  const st = STATUT_SPECIMEN_LABEL[s.statut];
                  return (
                    <TableRow key={s.specimen_id}>
                      <TableCell className="font-mono text-xs">{s.numero}</TableCell>
                      <TableCell>{formatDate(s.date_envoi)}</TableCell>
                      <TableCell className="font-medium">{s.etablissement}</TableCell>
                      <TableCell>{s.representant_nom ?? "—"}</TableCell>
                      <TableCell>{s.ville ?? "—"}</TableCell>
                      <TableCell className="text-right">{s.nb_produits}</TableCell>
                      <TableCell className="text-right">{s.total_quantite}</TableCell>
                      <TableCell>
                        <Badge style={{ backgroundColor: st?.color, color: "white" }}>
                          {st?.label ?? s.statut}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {s.gestionnaire_nom ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button aria-label="Voir" asChild variant="ghost" size="icon" title="Voir">
                            <Link
                              to="/specimens/$specimenId"
                              params={{ specimenId: s.specimen_id }}
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button aria-label="Imprimer"
                            variant="ghost"
                            size="icon"
                            title="Imprimer"
                            disabled={printingId === s.specimen_id}
                            onClick={() => handlePrint(s)}
                          >
                            {printingId === s.specimen_id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Printer className="h-4 w-4" />
                            )}
                          </Button>
                          {s.statut === "enregistre" && (
                            <Can permission="specimens.annuler">
                              <Button aria-label="Annuler"
                                variant="ghost"
                                size="icon"
                                title="Annuler"
                                onClick={() => setToCancel(s)}
                              >
                                <Ban className="h-4 w-4 text-destructive" />
                              </Button>
                            </Can>
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
      </div>

      <AlertDialog open={!!toCancel} onOpenChange={(o) => !o && setToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler le spécimen {toCancel?.numero} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action réinjectera {toCancel?.total_quantite ?? 0} article(s) dans le stock.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Retour</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toCancel && cancelMutation.mutate(toCancel.specimen_id)}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? "Annulation…" : "Confirmer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-md border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold ${accent ?? ""}`}>{value}</div>
    </div>
  );
}
