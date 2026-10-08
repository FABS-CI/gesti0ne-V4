import { CalendarRange, Check, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useExercice, type ExerciceStatut } from "@/contexts/ExerciceContext";
import { cn } from "@/lib/utils";

const STATUT_LABEL: Record<ExerciceStatut, string> = {
  preparation: "Préparation",
  actif: "Actif",
  cloture_en_cours: "Clôture en cours",
  cloture: "Clôturé",
  archive: "Archivé",
};

const STATUT_VARIANT: Record<ExerciceStatut, "default" | "secondary" | "outline" | "destructive"> =
  {
    actif: "default",
    preparation: "secondary",
    cloture_en_cours: "outline",
    cloture: "outline",
    archive: "outline",
  };

export function ExerciceSelector() {
  const {
    exercices,
    exerciceConsulte,
    exerciceActif,
    setExerciceConsulteId,
    isReadOnly,
    isLoading,
  } = useExercice();

  if (isLoading || !exerciceConsulte) {
    return <div className="h-9 w-32 animate-pulse rounded-md bg-muted" />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-9 gap-2 font-medium",
            isReadOnly && "border-warning/60 text-warning",
          )}
          title={isReadOnly ? "Exercice consulté (lecture seule)" : "Exercice actif"}
        >
          {isReadOnly ? (
            <Lock className="h-3.5 w-3.5" />
          ) : (
            <CalendarRange className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">Exercice</span>
          <span className="font-semibold">{exerciceConsulte.code}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Exercice consulté</span>
          {exerciceActif && (
            <span className="text-[10px] font-normal text-muted-foreground">
              Actif : {exerciceActif.code}
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {exercices.map((ex) => {
          const selected = ex.exercice_id === exerciceConsulte.exercice_id;
          return (
            <DropdownMenuItem
              key={ex.exercice_id}
              onClick={() => setExerciceConsulteId(ex.exercice_id)}
              className="flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2">
                {selected ? (
                  <Check className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <span className="w-3.5" />
                )}
                <span className="font-medium">{ex.code}</span>
              </div>
              <Badge variant={STATUT_VARIANT[ex.statut]} className="text-[10px]">
                {STATUT_LABEL[ex.statut]}
              </Badge>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
