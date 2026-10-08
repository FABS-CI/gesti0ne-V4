import { askConfirm } from "@/components/common/GlobalConfirm";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Plus, Eye, FileText, Layers, Globe2, Lock, LockOpen, Printer, Trash2, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { listDepots } from "@/lib/depots-api";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResponsiveTable } from "@/components/layout/ResponsiveTable";
import { Can } from "@/components/rbac/Can";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listInventaires,
  STATUT_INVENTAIRE_LABEL,
  STATUTS_INVENTAIRE,
  TYPES_INVENTAIRE,
  creerInventaireTheorique,
  creerInventaireGlobal,
  supprimerInventaire,
  verrouillerInventaire,
  deverrouillerInventaire,
} from "@/lib/inventaires-api";
import { formatDate, formatFCFA } from "@/lib/format";
import { useExerciceConsulteId } from "@/contexts/ExerciceContext";
import { describeSupabaseError } from "@/lib/rbac-api";

import { authRouteHead } from "@/lib/route-head";
import { FilterBadges, type FilterBadge } from "@/components/common/FilterBadges";
import { EmptyState } from "@/components/common/EmptyState";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
export const Route = createFileRoute("/_authenticated/inventaires/")({
  head: () => authRouteHead("Inventaires"),
  component: InventairesPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function InventairesPage() {
  const [statut, setStatut] = useState<string>("");
  const [type, setType] = useState<string>("");
  const [q, setQ] = useState("");
  const [theoriqueOpen, setTheoriqueOpen] = useState(false);
  const [theoriqueDepot, setTheoriqueDepot] = useState<string>("");
  const qc = useQueryClient();
  const exerciceId = useExerciceConsulteId();

  const { data: depots = [] } = useQuery({ queryKey: ["depots"], queryFn: listDepots });

  const theoriqueMut = useMutation({
    mutationFn: (depotId: string) =>
      creerInventaireTheorique({
        depot_id: depotId,
        date_inventaire: new Date().toISOString().slice(0, 10),
      }),
    onSuccess: () => {
      toast.success("Inventaire théorique généré");
      setTheoriqueOpen(false);
      qc.invalidateQueries({ queryKey: ["inventaires"] });
    },
    onError: (e: Error) => {
      const d = describeSupabaseError(e);
      toast.error(d.title, { description: d.message });
    },
  });

  const globalMut = useMutation({
    mutationFn: () => creerInventaireGlobal(),
    onSuccess: () => {
      toast.success("Inventaire global généré");
      qc.invalidateQueries({ queryKey: ["inventaires"] });
    },
    onError: (e: Error) => {
      const d = describeSupabaseError(e);
      toast.error(d.title, { description: d.message });
    },
  });

  const supprimerMut = useMutation({
    mutationFn: (id: string) => supprimerInventaire(id),
    onSuccess: () => {
      toast.success("Inventaire supprimé");
      qc.invalidateQueries({ queryKey: ["inventaires"] });
    },
    onError: (e: Error) => {
      const d = describeSupabaseError(e);
      toast.error(d.title, { description: d.message });
    },
  });

  const verrouillerMut = useMutation({
    mutationFn: (id: string) => verrouillerInventaire(id),
    onSuccess: () => {
      toast.success("Inventaire verrouillé");
      qc.invalidateQueries({ queryKey: ["inventaires"] });
    },
    onError: (e: Error) => {
      const d = describeSupabaseError(e);
      toast.error(d.title, { description: d.message });
    },
  });

  const deverrouillerMut = useMutation({
    mutationFn: (id: string) => deverrouillerInventaire(id),
    onSuccess: () => {
      toast.success("Inventaire déverrouillé");
      qc.invalidateQueries({ queryKey: ["inventaires"] });
    },
    onError: (e: Error) => {
      const d = describeSupabaseError(e);
      toast.error(d.title, { description: d.message });
    },
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["inventaires", exerciceId, statut, type],
    enabled: !!exerciceId,
    queryFn: () =>
      listInventaires({ statut: statut || undefined, type: type || undefined, exerciceId }),
  });

  const filtered = items.filter(
    (i) =>
      !q ||
      i.numero.toLowerCase().includes(q.toLowerCase()) ||
      (i.depots?.nom ?? "").toLowerCase().includes(q.toLowerCase()),
  );

  const typeLabel = TYPES_INVENTAIRE.find((t) => t.value === type)?.label ?? type;
  const statutLabel = STATUTS_INVENTAIRE.find((s) => s.value === statut)?.label ?? statut;
  const hasActiveFilters = !!q || !!type || !!statut;
  const resetAllFilters = () => {
    setQ("");
    setType("");
    setStatut("");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-7 w-7 text-primary" />
          <div>
            <h1 className="ds-page-title">Inventaires</h1>
            <p className="text-sm text-muted-foreground">
              Comptages physiques et rapports d'inventaire par dépôt
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Can permission="inventaires.creer">
          <Dialog open={theoriqueOpen} onOpenChange={setTheoriqueOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Layers className="h-4 w-4 mr-2" />
                Inventaire théorique
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Inventaire théorique par dépôt</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                <Label>Dépôt</Label>
                <Select value={theoriqueDepot} onValueChange={setTheoriqueDepot}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un dépôt" />
                  </SelectTrigger>
                  <SelectContent>
                    {depots.map((d) => (
                      <SelectItem key={d.depot_id} value={d.depot_id}>
                        {d.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => theoriqueDepot && theoriqueMut.mutate(theoriqueDepot)}
                  disabled={!theoriqueDepot || theoriqueMut.isPending}
                >
                  Générer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </Can>
          <Can permission="inventaires.creer">
          <Button
            variant="outline"
            onClick={() => globalMut.mutate()}
            disabled={globalMut.isPending}
          >
            <Globe2 className="h-4 w-4 mr-2" />
            Inventaire global
          </Button>
          </Can>
          <Can permission="inventaires.creer">
          <Button asChild>
            <Link to="/inventaires/nouveau-physique">
              <Plus className="h-4 w-4 mr-2" />
              Nouvel inventaire physique
            </Link>
          </Button>
          </Can>
        </div>
      </div>

      <div className="rounded-md border bg-card p-4 flex flex-wrap gap-3">
        <Input
          placeholder="Rechercher (numéro, dépôt)…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-64"
        />
        <Select value={type || "all"} onValueChange={(v) => setType(v === "all" ? "" : v)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {TYPES_INVENTAIRE.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statut || "all"} onValueChange={(v) => setStatut(v === "all" ? "" : v)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {STATUTS_INVENTAIRE.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <FilterBadges
        badges={[
          ...(q ? [{ key: "q", label: `Recherche : ${q}`, onClear: () => setQ("") } as FilterBadge] : []),
          ...(type ? [{ key: "type", label: `Type : ${typeLabel}`, onClear: () => setType("") } as FilterBadge] : []),
          ...(statut ? [{ key: "statut", label: `Statut : ${statutLabel}`, onClear: () => setStatut("") } as FilterBadge] : []),
        ]}
        onResetAll={resetAllFilters}
      />

      <div className="rounded-md border bg-card">
        <ResponsiveTable stickyFirstCol>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numéro</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Dépôt</TableHead>
                <TableHead className="text-right">Produits</TableHead>
                <TableHead className="text-right">Écarts</TableHead>
                <TableHead className="text-right">Valeur</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="w-48 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    Chargement…
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-6">
                    <EmptyState
                      variant={hasActiveFilters ? "compact" : "rich"}
                      icon={ClipboardList}
                      title={
                        hasActiveFilters
                          ? "Aucun inventaire ne correspond aux filtres appliqués."
                          : "Aucun inventaire pour cet exercice."
                      }
                      description={
                        hasActiveFilters
                          ? undefined
                          : "Lancez un inventaire physique pour recaler vos stocks et détecter les écarts par dépôt."
                      }
                      onReset={hasActiveFilters ? resetAllFilters : undefined}
                      className="border-none"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((i) => {
                  const st = STATUT_INVENTAIRE_LABEL[i.statut] ?? {
                    label: i.statut,
                    color: "#94A3B8",
                  };
                  return (
                    <TableRow key={i.inventaire_id}>
                      <TableCell className="font-mono text-xs">{i.numero}</TableCell>
                      <TableCell className="capitalize">{i.type_inventaire}</TableCell>
                      <TableCell>
                        {formatDate(i.date_inventaire)}
                      </TableCell>
                      <TableCell>{i.depots?.nom ?? "—"}</TableCell>
                      <TableCell className="text-right">{i.nb_produits}</TableCell>
                      <TableCell className="text-right">
                        {i.nb_ecarts > 0 ? (
                          <span className="text-warning font-semibold">{i.nb_ecarts}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{formatFCFA(i.valeur_totale)}</TableCell>
                      <TableCell>
                        <Badge style={{ backgroundColor: st.color, color: "white" }}>
                          {st.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <Button aria-label="Ouvrir" asChild size="icon" variant="ghost" title="Ouvrir">
                            <Link
                              to="/inventaires/$inventaireId"
                              params={{ inventaireId: i.inventaire_id }}
                            >
                              {i.statut === "brouillon" ? (
                                <FileText className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Link>
                          </Button>
                          {i.statut === "brouillon" ? (
                            <Button aria-label="Verrouiller"
                              size="icon"
                              variant="ghost"
                              title="Verrouiller"
                              onClick={() => verrouillerMut.mutate(i.inventaire_id)}
                              disabled={verrouillerMut.isPending}
                            >
                              <LockOpen className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button aria-label="Déverrouiller"
                              size="icon"
                              variant="ghost"
                              title="Déverrouiller"
                              onClick={() => deverrouillerMut.mutate(i.inventaire_id)}
                              disabled={deverrouillerMut.isPending}
                            >
                              <Lock className="h-4 w-4 text-primary" />
                            </Button>
                          )}
                          <Button aria-label="Imprimer"
                            size="icon"
                            variant="ghost"
                            title="Imprimer"
                            onClick={() => window.open(`/inventaires/${i.inventaire_id}`, "_blank")}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                          <Button aria-label="Supprimer"
                            size="icon"
                            variant="ghost"
                            title="Supprimer"
                            onClick={async () => {
                              if (await askConfirm(`Supprimer l'inventaire ${i.numero} ?`)) {
                                supprimerMut.mutate(i.inventaire_id);
                              }
                            }}
                            disabled={supprimerMut.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
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
