import { askConfirm } from "@/components/common/GlobalConfirm";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Warehouse } from "lucide-react";
import { toast } from "sonner";

import {
  listDepots,
  createDepot,
  updateDepot,
  deleteDepot,
  definirDepotPrincipal,
  type Depot,
  type DepotInput,
} from "@/lib/depots-api";
import { supabase } from "@/integrations/supabase/client";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { EMPTY_DEPOT } from "@/lib/depots-helpers";

import { Button } from "@/components/ui/button";
import { DepotsFilters } from "@/components/depots/DepotsFilters";
import { DepotsTable } from "@/components/depots/DepotsTable";
import { DepotFormDialog } from "@/components/depots/DepotFormDialog";
import { useConfirmDelete } from "@/hooks/use-confirm-delete";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { friendlyError } from '@/lib/friendly-error';

export const Route = createFileRoute("/_authenticated/depots")({
  component: DepotsPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function DepotsPage() {
  const qc = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirmDelete();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Depot | null>(null);
  const [form, setForm] = useState<DepotInput>(EMPTY_DEPOT);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statutFilter, setStatutFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const q = useDebouncedValue(search, 300);

  const { data: depots = [], isLoading } = useQuery({
    queryKey: ["depots"],
    queryFn: listDepots,
  });

  const { data: stockCounts = {} } = useQuery({
    queryKey: ["depots-stock-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("stocks_depots").select("depot_id, quantite");
      const map: Record<string, number> = {};
      (data ?? []).forEach((r: { depot_id: string; quantite: number }) => {
        if (r.quantite > 0) map[r.depot_id] = (map[r.depot_id] ?? 0) + 1;
      });
      return map;
    },
  });

  const save = useMutation({
    mutationFn: (input: DepotInput) =>
      editing ? updateDepot(editing.depot_id, input) : createDepot(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["depots"] });
      toast.success(editing ? "Dépôt modifié" : "Dépôt créé");
      setOpen(false);
    },
    onError: (e: unknown) => toast.error(friendlyError(e, "Erreur")),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteDepot(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["depots"] });
      toast.success("Dépôt désactivé");
    },
    onError: (e: unknown) => toast.error(friendlyError(e, "Erreur")),
  });

  const promote = useMutation({
    mutationFn: (id: string) => definirDepotPrincipal(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["depots"] });
      toast.success("Dépôt principal mis à jour");
    },
    onError: (e: unknown) => toast.error(friendlyError(e, "Erreur")),
  });

  function openNew() {
    setEditing(null);
    setForm(EMPTY_DEPOT);
    setOpen(true);
  }

  function openEdit(d: Depot) {
    setEditing(d);
    setForm({
      code: d.code,
      nom: d.nom,
      type_depot: d.type_depot ?? "secondaire",
      description: d.description ?? "",
      pays: d.pays ?? "Côte d'Ivoire",
      ville: d.ville ?? "",
      commune: d.commune ?? "",
      quartier: d.quartier ?? "",
      adresse: d.adresse ?? "",
      code_postal: d.code_postal ?? "",
      latitude: d.latitude,
      longitude: d.longitude,
      responsable: d.responsable ?? "",
      responsable_email: d.responsable_email ?? "",
      telephone: d.telephone ?? "",
      capacite: d.capacite,
      actif: d.actif,
      is_principal: d.is_principal,
    });
    setOpen(true);
  }

  const filtered = useMemo(() => {
    return depots.filter((d) => {
      if (typeFilter !== "all" && d.type_depot !== typeFilter) return false;
      if (statutFilter === "actif" && !d.actif) return false;
      if (statutFilter === "inactif" && d.actif) return false;
      if (q) {
        const s = q.toLowerCase();
        return (
          d.code.toLowerCase().includes(s) ||
          d.nom.toLowerCase().includes(s) ||
          (d.ville ?? "").toLowerCase().includes(s) ||
          (d.commune ?? "").toLowerCase().includes(s) ||
          (d.responsable ?? "").toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [depots, typeFilter, statutFilter, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="ds-page-title flex items-center gap-2">
            <Warehouse className="h-6 w-6 text-primary" /> Dépôts
          </h1>
          <p className="text-sm text-muted-foreground">Gestion des entrepôts</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" /> Nouveau dépôt
        </Button>
      </div>

      <DepotsFilters
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        statutFilter={statutFilter}
        onStatutFilterChange={setStatutFilter}
      />

      <DepotsTable
        isLoading={isLoading}
        items={pageItems}
        stockCounts={stockCounts}
        onEdit={openEdit}
        onPromote={(id, nom) => {
          if (
            window.confirm(
              `Définir « ${nom} » comme dépôt principal ?\n\nLes sorties de stock se feront depuis ce dépôt.`,
            )
          ) {
            promote.mutate(id);
          }
        }}
        onDelete={async (id) => {
          const r = await confirm({
            title: "Supprimer ce dépôt ?",
            entityLabel: "le dépôt",
            description:
              "La suppression est bloquée si des stocks ou mouvements sont rattachés au dépôt.",
            motifRequired: true,
          });
          if (r === false) return;
          del.mutate(id);
        }}
      />

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

      <DepotFormDialog
        open={open}
        onOpenChange={setOpen}
        editing={!!editing}
        form={form}
        setForm={setForm}
        submitting={save.isPending}
        onSubmit={() => {
          if (!form.code.trim() || !form.nom.trim()) {
            toast.error("Code et nom requis");
            return;
          }
          save.mutate(form);
        }}
      />
      {confirmDialog}
    </div>
  );
}
