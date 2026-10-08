import { MapPin, Pencil, Star, Trash2, Warehouse } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Can } from "@/components/rbac/Can";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResponsiveTable } from "@/components/layout/ResponsiveTable";
import type { Depot } from "@/lib/depots-api";

interface Props {
  isLoading: boolean;
  items: Depot[];
  stockCounts: Record<string, number>;
  onEdit: (d: Depot) => void;
  onPromote: (id: string, nom: string) => void;
  onDelete: (id: string) => void;
}

export function DepotsTable({ isLoading, items, stockCounts, onEdit, onPromote, onDelete }: Props) {
  return (
    <div className="rounded-lg border">
      <ResponsiveTable stickyFirstCol>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Ville</TableHead>
              <TableHead>Commune</TableHead>
              <TableHead>Responsable</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead className="text-right">Produits</TableHead>
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
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-6">
                  <EmptyState
                    variant="rich"
                    icon={Warehouse}
                    title="Aucun dépôt configuré"
                    description="Créez au moins un dépôt pour stocker vos produits et permettre entrées, sorties et transferts."
                    className="border-none"
                  />
                </TableCell>
              </TableRow>
            ) : (
              items.map((d) => (
                <TableRow key={d.depot_id}>
                  <TableCell className="font-mono text-sm">{d.code}</TableCell>
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      {d.nom}
                      {d.is_principal && <Star className="h-3.5 w-3.5 text-warning" />}
                    </span>
                  </TableCell>
                  <TableCell className="capitalize text-sm">{d.type_depot}</TableCell>
                  <TableCell>{d.ville ?? "—"}</TableCell>
                  <TableCell>{d.commune ?? "—"}</TableCell>
                  <TableCell>{d.responsable ?? "—"}</TableCell>
                  <TableCell>{d.telephone ?? "—"}</TableCell>
                  <TableCell className="text-right">{stockCounts[d.depot_id] ?? 0}</TableCell>
                  <TableCell>
                    <Badge variant={d.actif ? "default" : "secondary"}>
                      {d.actif ? "Actif" : "Inactif"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {d.latitude && d.longitude && (
                      <Button aria-label="Voir sur Google Maps" variant="ghost" size="icon" asChild title="Voir sur Google Maps">
                        <a
                          href={`https://www.google.com/maps?q=${d.latitude},${d.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <MapPin className="h-4 w-4 text-info" />
                        </a>
                      </Button>
                    )}
                    {!d.is_principal && d.actif && (
                      <Button aria-label="Définir comme dépôt principal"
                        variant="ghost"
                        size="icon"
                        title="Définir comme dépôt principal"
                        onClick={() => onPromote(d.depot_id, d.nom)}
                      >
                        <Star className="h-4 w-4 text-muted-foreground hover:text-warning" />
                      </Button>
                    )}
                    <Button aria-label="Modifier" variant="ghost" size="icon" onClick={() => onEdit(d)} title="Modifier">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Can permission="depots.supprimer">
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={d.is_principal}
                        title={d.is_principal ? "Dépôt principal — non supprimable" : "Supprimer"}
                        onClick={() => onDelete(d.depot_id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </Can>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ResponsiveTable>
    </div>
  );
}
