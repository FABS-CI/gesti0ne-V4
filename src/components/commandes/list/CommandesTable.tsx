import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResponsiveTable } from "@/components/layout/ResponsiveTable";
import { CommandeRow } from "@/components/commandes/CommandeRow";
import { CommandeCard } from "@/components/commandes/CommandeCard";
import { EmptyState } from "@/components/common/EmptyState";
import { SkeletonTable, SkeletonList } from "@/components/ui/skeletons";
import type { Commande } from "@/lib/commandes-api";

export function CommandesTable({
  items,
  isLoading,
  q,
  statut,
  onResetFilters,
  readOnly,
  isSuperAdmin,
  canModifier,
  canValider,
  onValider,
  validerPending,
  onDelete,
}: {
  items: Commande[];
  isLoading: boolean;
  q: string;
  statut: string;
  onResetFilters: () => void;
  readOnly: boolean;
  isSuperAdmin: boolean;
  canModifier: boolean;
  canValider: boolean;
  onValider: (id: string) => void;
  validerPending: boolean;
  onDelete: (c: Commande) => void;
}) {
  const hasFilters = Boolean(q) || statut !== "all";
  const emptyState = hasFilters ? (
    <EmptyState
      title="Aucune commande ne correspond aux filtres"
      description="Modifie ta recherche ou réinitialise les filtres pour retrouver tes commandes."
      onReset={onResetFilters}
    />
  ) : (
    <EmptyState
      variant="rich"
      title="Aucune commande pour le moment"
      description="Commence par créer une commande à partir d'un client. Elle générera automatiquement bon de livraison, facture et paiements."
      action={
        !readOnly ? (
          <Button asChild>
            <Link to="/commandes/nouvelle">Créer la première commande</Link>
          </Button>
        ) : undefined
      }
      hints={
        !readOnly ? (
          <>
            <span className="rounded-full border bg-card px-2.5 py-1 text-xs text-muted-foreground">
              Astuce · <kbd className="font-mono">Ctrl</kbd>+<kbd className="font-mono">K</kbd> pour
              la recherche rapide
            </span>
            <Link
              to="/clients"
              className="rounded-full border bg-card px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Voir mes clients →
            </Link>
          </>
        ) : undefined
      }
    />
  );

  const mobileCards = (
    <div className="space-y-2 p-2">
      {isLoading ? (
        <SkeletonList rows={6} />
      ) : items.length === 0 ? (
        <div className="py-8">{emptyState}</div>
      ) : (
        items.map((c) => (
          <CommandeCard
            key={c.commande_id}
            commande={c}
            readOnly={readOnly}
            isSuperAdmin={isSuperAdmin}
            canModifier={canModifier}
            canValider={canValider}
            onValider={onValider}
            validerPending={validerPending}
            onDelete={onDelete}
          />
        ))
      )}
    </div>
  );

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <ResponsiveTable mobileCards={mobileCards}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Référence</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="p-4">
                  <SkeletonTable rows={8} cols={6} />
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center">
                  {emptyState}
                </TableCell>
              </TableRow>
            ) : (
              items.map((c) => (
                <CommandeRow
                  key={c.commande_id}
                  commande={c}
                  readOnly={readOnly}
                  isSuperAdmin={isSuperAdmin}
                  canModifier={canModifier}
                  canValider={canValider}
                  onValider={onValider}
                  validerPending={validerPending}
                  onDelete={onDelete}
                />
              ))
            )}
          </TableBody>
        </Table>
      </ResponsiveTable>
    </div>
  );
}
