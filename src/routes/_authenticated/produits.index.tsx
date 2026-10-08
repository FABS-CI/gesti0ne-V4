import { createFileRoute } from "@tanstack/react-router";
import { friendlyError } from '@/lib/friendly-error';
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Plus } from "lucide-react";
import { toast } from "sonner";

import {
  type Produit,
  type ProduitInput,
  createProduit,
  deleteProduit,
  disableProduit,
  listProduits,
  updateProduit,
} from "@/lib/produits-api";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useUserRoles } from "@/hooks/use-user-roles";
import { usePermissions } from "@/hooks/use-permissions";
import {
  PAGE_SIZE,
  PRIVILEGED_ROLES,
  emptyForm,
  exportProduitsPdf,
} from "@/lib/produits-index-helpers";
import { Button } from "@/components/ui/button";
import { FilterBadges, type FilterBadge } from "@/components/common/FilterBadges";
import { ProduitsFilters } from "@/components/produits/list/ProduitsFilters";
import { ProduitsTable } from "@/components/produits/list/ProduitsTable";
import { ProduitFormDialog } from "@/components/produits/list/ProduitFormDialog";
import { RenderProfiler } from "@/hooks/use-render-profiler";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { describeSupabaseError } from "@/lib/rbac-api";

import { authRouteHead } from "@/lib/route-head";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
// Route principale du catalogue produits
export const Route = createFileRoute("/_authenticated/produits/")({
  head: () => authRouteHead("Produits"),
  component: ProduitsPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function ProduitsPage() {
  const queryClient = useQueryClient();
  const { hasRole, hasAny, isLoading: rolesLoading } = useUserRoles();
  const { has: hasPerm } = usePermissions();
  const isRestrictedViewer =
    (hasRole("assistante") || hasRole("comptable") || hasRole("secretariat")) &&
    !hasAny(PRIVILEGED_ROLES as unknown as Parameters<typeof hasAny>[0]);
  // RBAC v2 : "voir_prix" ou "voir_couts" débloque l'affichage sensible.
  // Fallback : ancienne logique par rôle (rétrocompatible).
  const canSeeSensitive =
    hasPerm("produits.voir_prix") || hasPerm("produits.voir_couts") || !isRestrictedViewer;
  const canMutate = !isRestrictedViewer;
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [niveauFilter, setNiveauFilter] = useState("");
  const [actifFilter, setActifFilter] = useState("true");
  const [page, setPage] = useState(1);

  const q = useDebouncedValue(search, 300);
  const niveau = useDebouncedValue(niveauFilter, 300);

  const { data, isLoading } = useQuery({
    queryKey: ["produits", q, catFilter, niveau, actifFilter, page],
    queryFn: () =>
      listProduits({
        q: q || undefined,
        categorie: catFilter === "all" ? undefined : catFilter,
        niveau: niveau || undefined,
        actif: actifFilter === "all" ? undefined : actifFilter === "true",
        page,
        pageSize: PAGE_SIZE,
      }),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Produit | null>(null);
  const [form, setForm] = useState<ProduitInput>(emptyForm);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.titre.trim()) throw new Error("Le titre est obligatoire");
      if (editing) return updateProduit(editing.produit_id, form);
      return createProduit(form);
    },
    onSuccess: () => {
      toast.success(editing ? "Produit mis à jour" : "Produit créé");
      queryClient.invalidateQueries({ queryKey: ["produits"] });
      setDialogOpen(false);
    },
    onError: (e) => {
      const d = describeSupabaseError(e);
      toast.error(d.title, { description: d.message });
    },
  });

  const disableMutation = useMutation({
    mutationFn: (id: string) => disableProduit(id),
    onSuccess: () => {
      toast.success("Produit désactivé");
      queryClient.invalidateQueries({ queryKey: ["produits"] });
    },
    onError: (e) => {
      const d = describeSupabaseError(e);
      toast.error(d.title, { description: d.message });
    },
  });

  const [toDelete, setToDelete] = useState<Produit | null>(null);
  const deleteMutation = useMutation({
    mutationFn: async ({ id, motif }: { id: string; motif: string | null }) => {
      try {
        return await deleteProduit(id, motif);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/foreign key|violates foreign|referenced|dependenc|référenc/i.test(msg)) {
          await disableProduit(id);
          toast.info("Produit référencé : désactivé au lieu d'être supprimé");
          return null;
        }
        throw err;
      }
    },
    onSuccess: (res) => {
      if (res !== null) toast.success("Produit supprimé");
      queryClient.invalidateQueries({ queryKey: ["produits"] });
      setToDelete(null);
    },
    onError: (e) => {
      const d = describeSupabaseError(e);
      toast.error(d.title, { description: d.message });
    },
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const hasActiveFilters =
    !!q || catFilter !== "all" || !!niveau || actifFilter !== "true";
  const resetAllFilters = () => {
    setSearch("");
    setCatFilter("all");
    setNiveauFilter("");
    setActifFilter("true");
    setPage(1);
  };

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(p: Produit) {
    setEditing(p);
    setForm({
      titre: p.titre,
      isbn: p.isbn ?? "",
      categorie: p.categorie,
      niveau: p.niveau ?? "",
      matiere: p.matiere ?? "",
      auteur: p.auteur ?? "",
      editeur: p.editeur ?? "",
      prix_vente: p.prix_vente,
      prix_achat: p.prix_achat,
      seuil_alerte: p.seuil_alerte,
    });
    setDialogOpen(true);
  }

  async function handleExport() {
    try {
      toast.loading("Génération du PDF…", { id: "produits-export" });
      const n = await exportProduitsPdf(
        {
          q: q || undefined,
          categorie: catFilter === "all" ? undefined : catFilter,
          niveau: niveau || undefined,
          actif: actifFilter === "all" ? undefined : actifFilter === "true",
        },
        canSeeSensitive,
      );
      toast.success(`${n} produit(s) exporté(s)`, { id: "produits-export" });
    } catch (e) {
      toast.error(friendlyError(e, "Erreur export PDF"), {
        id: "produits-export",
      });
    }
  }

  if (rolesLoading) {
    return <div className="p-8 text-center text-muted-foreground">Chargement…</div>;
  }

  return (
    <RenderProfiler id="page:produits">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="ds-page-title">Produits</h1>
            <p className="text-sm text-muted-foreground">{total} produit(s)</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" /> Export PDF
            </Button>
            {canMutate && (
              <Button onClick={openNew}>
                <Plus className="mr-2 h-4 w-4" /> Nouveau produit
              </Button>
            )}
          </div>
        </div>

        <ProduitsFilters
          search={search}
          setSearch={setSearch}
          catFilter={catFilter}
          setCatFilter={setCatFilter}
          niveauFilter={niveauFilter}
          setNiveauFilter={setNiveauFilter}
          actifFilter={actifFilter}
          setActifFilter={setActifFilter}
          onAnyChange={() => setPage(1)}
        />

        <FilterBadges
          badges={
            [
              q && { key: "q", label: `Recherche : ${q}`, onClear: () => setSearch("") },
              catFilter !== "all" && {
                key: "cat",
                label: `Catégorie : ${catFilter}`,
                onClear: () => setCatFilter("all"),
              },
              niveau && {
                key: "niveau",
                label: `Niveau : ${niveau}`,
                onClear: () => setNiveauFilter(""),
              },
              actifFilter !== "true" && {
                key: "actif",
                label: `Statut : ${actifFilter === "all" ? "Tous" : "Inactifs"}`,
                onClear: () => setActifFilter("true"),
              },
            ].filter(Boolean) as FilterBadge[]
          }
          onResetAll={resetAllFilters}
        />

        <ProduitsTable
          items={items}
          isLoading={isLoading}
          canSeeSensitive={canSeeSensitive}
          canMutate={canMutate}
          onEdit={openEdit}
          onDisable={(p) => setToDelete(p)}
          hasActiveFilters={hasActiveFilters}
          onResetFilters={resetAllFilters}
          onCreate={openNew}
        />

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-end gap-2">
            <span className="text-sm text-muted-foreground">
              Page {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Préc.
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Suiv.
            </Button>
          </div>
        )}

        <ProduitFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          editing={!!editing}
          form={form}
          setForm={setForm}
          onSave={() => saveMutation.mutate()}
          saving={saveMutation.isPending}
          produit={editing}
          onCoverChanged={() =>
            queryClient.invalidateQueries({ queryKey: ["produits"] })
          }
        />

        <ConfirmDeleteDialog
          open={!!toDelete}
          onOpenChange={(o) => !o && setToDelete(null)}
          title="Supprimer ce produit ?"
          entityLabel="le produit"
          entityName={toDelete?.titre}
          description="La suppression est bloquée si le produit est utilisé (commandes, colis, mouvements de stock). Dans ce cas, la fiche sera désactivée automatiquement."
          consequences={[
            "Fiche produit et catégorisation supprimées",
            "Si des mouvements existent → désactivation automatique",
          ]}
          motifRequired
          pending={deleteMutation.isPending || disableMutation.isPending}
          onConfirm={(motif) => {
            if (!toDelete) return;
            deleteMutation.mutate({ id: toDelete.produit_id, motif });
          }}
        />
      </div>
    </RenderProfiler>
  );
}
