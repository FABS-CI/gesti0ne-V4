import { Lock } from "lucide-react";
import { useExercice } from "@/contexts/ExerciceContext";

export function ExerciceReadOnlyBanner() {
  const { isReadOnly, exerciceConsulte, exerciceActif, setExerciceConsulteId } = useExercice();
  if (!isReadOnly || !exerciceConsulte || !exerciceActif) return null;
  return (
    <div className="flex items-center justify-between gap-3 border-b border-warning/40 bg-warning/10 px-3 py-1.5 text-xs text-warning sm:px-4">
      <div className="flex items-center gap-2">
        <Lock className="h-3.5 w-3.5" />
        <span>
          Vous consultez l'exercice <strong>{exerciceConsulte.code}</strong> en lecture seule. Toute
          création est bloquée. Exercice actif : <strong>{exerciceActif.code}</strong>.
        </span>
      </div>
      <button
        type="button"
        onClick={() => setExerciceConsulteId(exerciceActif.exercice_id)}
        className="rounded border border-warning/50 px-2 py-0.5 font-medium hover:bg-warning/20"
      >
        Revenir à l'actif
      </button>
    </div>
  );
}
