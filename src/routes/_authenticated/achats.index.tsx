import { createFileRoute, Link } from "@tanstack/react-router";
import { friendlyError } from '@/lib/friendly-error';
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ShoppingBag,
  Search,
  Plus,
  Download,
  Trash2,
  Eye,
  Printer,
  Pencil,
  RotateCcw,
  X,
} from "lucide-react";
import { Can } from "@/components/rbac/Can";
import { usePermissions } from "@/hooks/use-permissions";
import { toast } from "sonner";

import {
  listAchats,
  deleteAchat,
  listAchatLignesByAchats,
  getAchat,
  getAchatLignes,
  STATUTS_ACHAT,
  STATUT_ACHAT_LABEL,
  type AchatLigne,
} from "@/lib/achats-api";
import { listFournisseurs } from "@/lib/fournisseurs-api";
import { formatFCFA, formatDate } from "@/lib/format";
import { CATEGORIES_PRODUIT, CATEGORIE_LABEL } from "@/lib/company";
import { exportCsv } from "@/lib/export-csv";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useExerciceConsulteId } from "@/contexts/ExerciceContext";
import { describeSupabaseError } from "@/lib/rbac-api";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { generateApprovisionnementPDF } from "@/lib/pdf/fabsTemplates";
import { viewBlobAsync } from "@/lib/pdf/actions";
import { ProductCoverThumb } from "@/components/produits/ProductCoverThumb";

import { authRouteHead } from "@/lib/route-head";
import { FilterBadges, type FilterBadge } from "@/components/common/FilterBadges";
import { EmptyState } from "@/components/common/EmptyState";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
export const Route = createFileRoute("/_authenticated/achats/")({
  head: () => authRouteHead("Achats"),
  component: ApprovisionnementsPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function ApprovisionnementsPage() {
  const queryClient = useQueryClient();
  const { has } = usePermissions();
  const canCreate = has("achats.creer");

  const [search, setSearch] = useState("");
  const [statutFilter, setStatutFilter] = useState("all");
  const [fournisseurFilter, setFournisseurFilter] = useState("all");
  const [articleSearch, setArticleSearch] = useState("");
  const [refArticleSearch, setRefArticleSearch] = useState("");
  const [categorieFilter, setCategorieFilter] = useState("all");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const q = useDebouncedValue(search, 300);
  const article = useDebouncedValue(articleSearch, 300);
  const refArticle = useDebouncedValue(refArticleSearch, 300);
  const exerciceId = useExerciceConsulteId();

  const { data: achats = [], isLoading } = useQuery({
    queryKey: ["achats", exerciceId, q, statutFilter, article, refArticle, categorieFilter],
    enabled: !!exerciceId,
    queryFn: () =>
      listAchats(q, statutFilter === "all" ? undefined : statutFilter, exerciceId, {
        article: article || undefined,
        refArticle: refArticle || undefined,
        categorie: categorieFilter === "all" ? undefined : categorieFilter,
      }),
  });

  const { data: fournisseurs = [] } = useQuery({
    queryKey: ["fournisseurs", ""],
    queryFn: () => listFournisseurs(),
  });

  const { data: lignesMap = {} as Record<string, AchatLigne[]> } = useQuery({
    queryKey: ["achat-lignes-summary", achats.map((a) => a.achat_id).join(",")],
    enabled: achats.length > 0,
    queryFn: () => listAchatLignesByAchats(achats.map((a) => a.achat_id)),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, motif }: { id: string; motif: string | null }) => deleteAchat(id, motif),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["achats"] });
      toast.success("Approvisionnement supprimé");
      setToDelete(null);
    },
    onError: (e: unknown) => {
      const d = describeSupabaseError(e);
      toast.error(d.title, { description: d.message });
    },
  });

  const [toDelete, setToDelete] = useState<{ id: string; reference: string } | null>(null);

  const filtered = useMemo(() => {
    return achats.filter((a) => {
      if (fournisseurFilter !== "all" && a.fournisseur_id !== fournisseurFilter) return false;
      if (dateDebut && a.date_achat < dateDebut) return false;
      if (dateFin && a.date_achat > dateFin) return false;
      return true;
    });
  }, [achats, fournisseurFilter, dateDebut, dateFin]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  const hasActiveFilters =
    !!q ||
    statutFilter !== "all" ||
    fournisseurFilter !== "all" ||
    !!article ||
    !!refArticle ||
    categorieFilter !== "all" ||
    !!dateDebut ||
    !!dateFin;
  const fournisseurLabel =
    fournisseurs.find((f) => f.fournisseur_id === fournisseurFilter)?.raison_sociale ??
    fournisseurFilter;
  const resetAllFilters = () => {
    setSearch("");
    setStatutFilter("all");
    setFournisseurFilter("all");
    setArticleSearch("");
    setRefArticleSearch("");
    setCategorieFilter("all");
    setDateDebut("");
    setDateFin("");
    setPage(1);
  };

  async function handleExport() {
    await exportCsv(
      `liste_approvisionnements_fabs_${new Date().toISOString().slice(0, 10)}`,
      [
        "Numéro",
        "Date",
        "Fournisseur",
        "Nb articles",
        "Qté totale",
        "Montant",
        "Utilisateur",
        "Statut",
      ],
      filtered.map((a) => {
        const ls = lignesMap[a.achat_id] ?? [];
        const qte = ls.reduce((s, l) => s + l.quantite, 0);
        return [
          a.reference,
          a.date_achat,
          a.fournisseurs?.raison_sociale ?? "",
          String(ls.length),
          String(qte),
          String(a.montant),
          a.created_by_nom ?? "",
          STATUT_ACHAT_LABEL[a.statut]?.label ?? a.statut,
        ];
      }),
      {
        pageTitle: "LISTE DES APPROVISIONNEMENTS",
        summary: (() => {
          let totalMt = 0;
          let totalQte = 0;
          for (const a of filtered) {
            const ls = lignesMap[a.achat_id] ?? [];
            totalQte += ls.reduce((s, l) => s + l.quantite, 0);
            totalMt += Number(a.montant) || 0;
          }
          return [
            { label: "Nombre d'approvisionnements", value: String(filtered.length) },
            {
              label: "Fournisseurs distincts",
              value: String(new Set(filtered.map((a) => a.fournisseur_id)).size),
            },
            { label: "Quantité totale reçue", value: String(totalQte) },
            { label: "Montant total (FCFA)", value: formatFCFA(totalMt) },
          ];
        })(),
      },
    );
  }

  async function handlePrint(id: string) {
    const tid = toast.loading("Génération du reçu…");
    try {
      const [achat, lignes] = await Promise.all([getAchat(id), getAchatLignes(id)]);
      if (!achat) throw new Error("Approvisionnement introuvable");
      const blobPromise = generateApprovisionnementPDF({
        reference: achat.reference,
        date: achat.date_achat,
        clientNom: achat.fournisseurs?.raison_sociale ?? "—",
        codeClient: achat.fournisseurs?.reference ?? achat.reference_fournisseur ?? undefined,
        clientTel: achat.fournisseurs?.telephone ?? undefined,
        emailClient: achat.fournisseurs?.email ?? undefined,
        adresseClient: achat.fournisseurs?.adresse ?? undefined,
        villeClient: achat.fournisseurs?.ville ?? undefined,
        representant: achat.fournisseurs?.representant ?? undefined,
        lignes: lignes.map((l) => ({
          codeArticle: l.reference_produit ?? undefined,
          reference: l.designation,
          qte: Number(l.quantite),
          prixUnitaire: Number(l.prix_unitaire),
          remisePct: Number(l.remise_pct ?? 0),
          montant: Number(l.total_ligne),
        })),
        totalVente: Number(achat.montant),
        montantHT: Number(achat.montant),
        totalTTC: Number(achat.montant),
      });
      await viewBlobAsync(Promise.resolve(blobPromise), {
        title: `Reçu ${achat.reference}`,
        filename: `approvisionnement_${achat.reference}.pdf`,
      });
      toast.success("Reçu généré", { id: tid });
    } catch (e) {
      toast.error(friendlyError(e, "Erreur génération PDF"), { id: tid });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="ds-page-title flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-primary" /> Approvisionnements
          </h1>
          <p className="text-sm text-muted-foreground">Entrées de stock depuis les fournisseurs</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={!filtered.length}>
            <Download className="mr-2 h-4 w-4" /> Exporter
          </Button>
          {canCreate && (
            <Button asChild>
              <Link to="/achats/nouveau" search={{ edit: undefined }}>
                <Plus className="mr-2 h-4 w-4" /> Nouvel Approvisionnement
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative lg:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher (numéro, libellé)…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statutFilter} onValueChange={setStatutFilter}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            {STATUTS_ACHAT.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fournisseurFilter} onValueChange={setFournisseurFilter}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous fournisseurs</SelectItem>
            {fournisseurs.map((f) => (
              <SelectItem key={f.fournisseur_id} value={f.fournisseur_id}>
                {f.raison_sociale}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Input
            type="date"
            value={dateDebut}
            onChange={(e) => setDateDebut(e.target.value)}
            title="Du"
          />
          <Input
            type="date"
            value={dateFin}
            onChange={(e) => setDateFin(e.target.value)}
            title="Au"
          />
        </div>
        <Input
          placeholder="Article (désignation)…"
          value={articleSearch}
          onChange={(e) => {
            setArticleSearch(e.target.value);
            setPage(1);
          }}
        />
        <Input
          placeholder="Référence article…"
          value={refArticleSearch}
          onChange={(e) => {
            setRefArticleSearch(e.target.value);
            setPage(1);
          }}
        />
        <Select
          value={categorieFilter}
          onValueChange={(v) => {
            setCategorieFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes catégories</SelectItem>
            {CATEGORIES_PRODUIT.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <FilterBadges
        badges={[
          ...(q ? [{ key: "q", label: `Recherche : ${q}`, onClear: () => setSearch("") } as FilterBadge] : []),
          ...(statutFilter !== "all"
            ? [{ key: "statut", label: `Statut : ${STATUT_ACHAT_LABEL[statutFilter]?.label ?? statutFilter}`, onClear: () => setStatutFilter("all") } as FilterBadge]
            : []),
          ...(fournisseurFilter !== "all"
            ? [{ key: "fourn", label: `Fournisseur : ${fournisseurLabel}`, onClear: () => setFournisseurFilter("all") } as FilterBadge]
            : []),
          ...(article
            ? [{ key: "article", label: `Article : ${article}`, onClear: () => setArticleSearch("") } as FilterBadge]
            : []),
          ...(refArticle
            ? [{ key: "refart", label: `Réf. article : ${refArticle}`, onClear: () => setRefArticleSearch("") } as FilterBadge]
            : []),
          ...(categorieFilter !== "all"
            ? [{ key: "cat", label: `Catégorie : ${CATEGORIE_LABEL[categorieFilter] ?? categorieFilter}`, onClear: () => setCategorieFilter("all") } as FilterBadge]
            : []),
          ...(dateDebut || dateFin
            ? [{ key: "periode", label: `Période : ${dateDebut || "…"} → ${dateFin || "…"}`, onClear: () => { setDateDebut(""); setDateFin(""); } } as FilterBadge]
            : []),
        ]}
        onResetAll={resetAllFilters}
      />


      <div className="rounded-lg border">
        <ResponsiveTable stickyFirstCol>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Numéro</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Fournisseur</TableHead>
                <TableHead className="text-right">Articles</TableHead>
                <TableHead className="text-right">Qté</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : pageItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-6">
                    <EmptyState
                      variant={hasActiveFilters ? "compact" : "rich"}
                      icon={ShoppingBag}
                      title={
                        hasActiveFilters
                          ? "Aucun approvisionnement ne correspond aux filtres appliqués."
                          : "Aucun approvisionnement pour cet exercice."
                      }
                      description={
                        hasActiveFilters
                          ? undefined
                          : "Enregistrez vos approvisionnements pour tracer les entrées en stock, coûts d'achat et dettes fournisseurs."
                      }
                      onReset={hasActiveFilters ? resetAllFilters : undefined}
                      action={
                        !hasActiveFilters && canCreate ? (
                          <Button asChild size="sm">
                            <Link to="/achats/nouveau" search={{ edit: undefined }}>
                              <Plus className="mr-2 h-4 w-4" /> Nouvel approvisionnement
                            </Link>
                          </Button>
                        ) : undefined
                      }
                      className="border-none"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                pageItems.map((a) => {
                  const statutMeta = STATUT_ACHAT_LABEL[a.statut];
                  const ls = lignesMap[a.achat_id] ?? [];
                  const qte = ls.reduce((s, l) => s + l.quantite, 0);
                  return (
                    <TableRow key={a.achat_id}>
                      <TableCell className="py-1">
                        <div className="flex -space-x-2 overflow-hidden px-1">
                          {ls.slice(0, 3).map((l, idx) => (
                            <ProductCoverThumb
                              key={l.ligne_id}
                              produit={l.produits ? { ...l, ...l.produits, titre: l.designation } : { ...l, titre: l.designation }}
                              size="xs"
                              className="h-8 w-8 border-2 border-background shadow-sm"
                            />
                          ))}
                          {ls.length > 3 && (
                            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-xs font-bold ring-2 ring-background">
                              +{ls.length - 3}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{a.reference}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(a.date_achat)}</TableCell>
                      <TableCell>{a.fournisseurs?.raison_sociale ?? "—"}</TableCell>
                      <TableCell className="text-right">{ls.length}</TableCell>
                      <TableCell className="text-right">{qte}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatFCFA(Number(a.montant))}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {a.created_by_nom ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          style={{ color: statutMeta?.color, borderColor: statutMeta?.color }}
                        >
                          {statutMeta?.label ?? a.statut}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button aria-label="Consulter" variant="ghost" size="icon" asChild title="Consulter">
                          <Link to="/achats/$achatId" params={{ achatId: a.achat_id }}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Can permission="achats.modifier">
                          <Button aria-label={
                              ["recu", "paye", "annule"].includes(a.statut)
                                ? "Modifier (réservé Super Admin)"
                                : "Modifier"
                            }
                            variant="ghost"
                            size="icon"
                            asChild
                            title={
                              ["recu", "paye", "annule"].includes(a.statut)
                                ? "Modifier (réservé Super Admin)"
                                : "Modifier"
                            }
                          >
                            <Link
                              to="/achats/nouveau"
                              search={{ edit: a.achat_id } as never}
                            >
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>
                        </Can>
                        <Button aria-label="Imprimer"
                          variant="ghost"
                          size="icon"
                          title="Imprimer"
                          onClick={() => handlePrint(a.achat_id)}
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Can permission="achats.supprimer">
                          <Button aria-label={
                              ["recu", "paye"].includes(a.statut)
                                ? "Supprimer (réservé Super Admin)"
                                : "Supprimer"
                            }
                            variant="ghost"
                            size="icon"
                            title={
                              ["recu", "paye"].includes(a.statut)
                                ? "Supprimer (réservé Super Admin)"
                                : "Supprimer"
                            }
                            onClick={() =>
                              setToDelete({ id: a.achat_id, reference: a.reference })
                            }
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </Can>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </ResponsiveTable>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Précédent
          </Button>
          <span>
            Page {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Suivant
          </Button>
        </div>
      )}

      <ConfirmDeleteDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Supprimer cet approvisionnement ?"
        entityLabel="l'approvisionnement"
        entityName={toDelete?.reference}
        description="Bloqué si le statut est « reçu » ou « payé », ou si l'exercice est clôturé (sauf super_admin)."
        consequences={[
          "Lignes d'approvisionnement supprimées",
          "Mouvements de stock associés supprimés",
          "Écritures comptables et notifications liées supprimées",
        ]}
        motifRequired
        pending={deleteMutation.isPending}
        onConfirm={(motif) => {
          if (!toDelete) return;
          deleteMutation.mutate({ id: toDelete.id, motif });
        }}
      />
    </div>
  );
}
