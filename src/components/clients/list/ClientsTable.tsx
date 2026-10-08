import { Link, useNavigate } from "@tanstack/react-router";
import { Eye, Pencil, PowerOff, UserPlus, Users } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResponsiveTable } from "@/components/layout/ResponsiveTable";
import { formatFCFA } from "@/lib/format";
import { TYPE_COLOR, normalizeTypeClient } from "@/lib/company";
import type { Client } from "@/lib/clients-api";
import { Can } from "@/components/rbac/Can";
import { usePermissions } from "@/hooks/use-permissions";

interface Props {
  items: Client[];
  isLoading: boolean;
  readOnly: boolean;
  onDisable: (c: Client) => void;
  /** Un filtre est-il actif (recherche, type, statut, actifs exercice, CRM…) ? */
  hasActiveFilters?: boolean;
  /** Remet tous les filtres à leur valeur par défaut. */
  onResetFilters?: () => void;
}

export function ClientsTable({
  items,
  isLoading,
  readOnly,
  onDisable,
  hasActiveFilters,
  onResetFilters,
}: Props) {
  const navigate = useNavigate();
  const { has } = usePermissions();
  const canSeeSolde = has("clients.voir_ca");
  const colSpan = canSeeSolde ? 8 : 7;
  return (
    <div className="rounded-lg border bg-card">
      <ResponsiveTable stickyFirstCol>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Référence</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Représentant</TableHead>
              <TableHead>Téléphone</TableHead>
              {canSeeSolde && <TableHead className="text-right">Solde</TableHead>}
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={colSpan} className="py-10 text-center text-muted-foreground">
                  Chargement…
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colSpan} className="py-6">
                  <EmptyState
                    variant={hasActiveFilters ? "compact" : "rich"}
                    icon={Users}
                    title={
                      hasActiveFilters
                        ? "Aucun client ne correspond aux filtres appliqués."
                        : "Aucun client enregistré pour le moment."
                    }
                    description={
                      hasActiveFilters
                        ? undefined
                        : "Ajoutez vos clients pour émettre commandes, factures et suivre leur solde en temps réel."
                    }
                    onReset={hasActiveFilters ? onResetFilters : undefined}
                    action={
                      !hasActiveFilters && !readOnly ? (
                        <Button size="sm" onClick={() => navigate({ to: "/clients/nouveau" })}>
                          <UserPlus className="mr-2 h-4 w-4" /> Créer un client
                        </Button>
                      ) : undefined
                    }
                    className="border-none"
                  />
                </TableCell>
              </TableRow>
            ) : (
              items.map((c) => {
                const type = TYPE_COLOR[normalizeTypeClient(c.type_client)];
                return (
                  <TableRow
                    key={c.client_id}
                    className="group cursor-pointer transition-colors odd:bg-muted/20 hover:bg-primary/5"
                    onClick={() =>
                      navigate({ to: "/clients/$clientId", params: { clientId: c.client_id } })
                    }
                  >
                    <TableCell className="font-mono text-xs">{c.reference}</TableCell>
                    <TableCell className="font-medium">
                      <Link
                        to="/clients/$clientId"
                        params={{ clientId: c.client_id }}
                        className="hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {c.nom}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge
                        style={{
                          backgroundColor: type?.bg ?? "#CFD8DC",
                          color: type?.color ?? "#0A2540",
                        }}
                      >
                        {type?.label ?? c.type_client}
                      </Badge>
                    </TableCell>
                    <TableCell>{c.representant || "—"}</TableCell>
                    <TableCell>{c.telephone || "—"}</TableCell>
                    {canSeeSolde && (
                      <TableCell className="text-right">{formatFCFA(c.solde)}</TableCell>
                    )}
                    <TableCell>
                      {c.actif ? (
                        <span className="inline-flex items-center gap-1 text-xs text-success">
                          <span className="h-2 w-2 rounded-full bg-success" /> Actif
                        </span>
                      ) : (
                        <Badge variant="secondary">Désactivé</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                        <Button aria-label="Voir" variant="ghost" size="icon" asChild title="Voir">
                          <Link to="/clients/$clientId" params={{ clientId: c.client_id }}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        {!readOnly && (
                          <>
                            <Button aria-label="Modifier" variant="ghost" size="icon" asChild title="Modifier">
                              <Link
                                to="/clients/$clientId/modifier"
                                params={{ clientId: c.client_id }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Link>
                            </Button>
                            {c.actif && (
                              <Can permission="clients.supprimer">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => onDisable(c)}
                                  title="Désactiver"
                                  className="hover:bg-destructive/10"
                                >
                                  <PowerOff className="h-4 w-4 text-destructive" />
                                </Button>
                              </Can>
                            )}
                          </>
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
  );
}
