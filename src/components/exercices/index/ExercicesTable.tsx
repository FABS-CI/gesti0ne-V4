import { formatDateLong } from "@/lib/format";
import { Lock, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ExerciceStatut } from "@/contexts/ExerciceContext";
import { STATUT_LABEL, type EditingExercice } from "./exercices-shared";

type Exercice = {
  exercice_id: string;
  code: string;
  date_debut: string;
  date_fin: string;
  statut: ExerciceStatut;
  is_actif: boolean;
};

type Props = {
  exercices: Exercice[];
  canModifier: boolean;
  canCloturer: boolean;
  onEdit: (e: EditingExercice) => void;
  onPreviewCloture: (id: string) => void;
};

export function ExercicesTable({
  exercices,
  canModifier,
  canCloturer,
  onEdit,
  onPreviewCloture,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Liste des exercices</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Période</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {exercices.map((ex) => (
              <TableRow key={ex.exercice_id}>
                <TableCell className="font-semibold">{ex.code}</TableCell>
                <TableCell className="text-sm">
                  {formatDateLong(ex.date_debut)}{" "}
                  →{" "}
                  {formatDateLong(ex.date_fin)}
                </TableCell>
                <TableCell>
                  <Badge variant={ex.is_actif ? "default" : "outline"}>
                    {STATUT_LABEL[ex.statut]}
                    {ex.is_actif && " ●"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {canModifier && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          onEdit({
                            exercice_id: ex.exercice_id,
                            code: ex.code,
                            date_debut: ex.date_debut,
                            date_fin: ex.date_fin,
                            statut: ex.statut,
                          })
                        }
                      >
                        <Pencil className="mr-1 h-3.5 w-3.5" />
                        Modifier
                      </Button>
                    )}
                    {ex.is_actif && canCloturer && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onPreviewCloture(ex.exercice_id)}
                      >
                        <Lock className="mr-1 h-3.5 w-3.5" />
                        Aperçu clôture
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
