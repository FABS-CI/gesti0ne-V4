import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type Props = {
  editable: boolean;
  canRegulariser: boolean | undefined;
  nbEcarts: number;
  locked: boolean;
  onExport: () => void;
  onAnnuler: () => void;
  onValider: () => void;
  onRegulariser: () => void;
  onVerrouiller: () => void;
  onDeverrouiller: () => void;
  onSupprimer: () => void;
  onImprimer: () => void;
  validating: boolean;
};

export function InventaireHeaderActions({
  editable,
  canRegulariser,
  nbEcarts,
  locked,
  onExport,
  onAnnuler,
  onValider,
  onRegulariser,
  onVerrouiller,
  onDeverrouiller,
  onSupprimer,
  onImprimer,
  validating,
}: Props) {
  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={onExport}>
        PDF
      </Button>
      <Button variant="outline" onClick={onImprimer}>
        Imprimer
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline">{locked ? <>Déverrouiller</> : <>Verrouiller</>}</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {locked ? "Déverrouiller cet inventaire ?" : "Verrouiller cet inventaire ?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {locked
                ? "L'inventaire repassera en brouillon et pourra être modifié."
                : "L'inventaire sera marqué comme validé."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={locked ? onDeverrouiller : onVerrouiller}>
              {locked ? "Déverrouiller" : "Verrouiller"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive">Supprimer</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet inventaire ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est définitive et supprimera l'inventaire ainsi que ses lignes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={onSupprimer}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {editable && (
        <>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline">Annuler</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Annuler cet inventaire ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Le brouillon sera marqué comme annulé. Cette action est irréversible.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Non</AlertDialogCancel>
                <AlertDialogAction onClick={onAnnuler}>Oui</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button onClick={onValider} disabled={validating}>
            {validating ? "Validation…" : "Valider l'inventaire"}
          </Button>
        </>
      )}
      {!editable && canRegulariser && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button>Régulariser les écarts</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Régulariser les écarts ?</AlertDialogTitle>
              <AlertDialogDescription>
                {nbEcarts} écart(s) détecté(s). Des mouvements d'ajustement seront créés pour
                aligner le stock du dépôt sur les quantités comptées. Action irréversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={onRegulariser}>Confirmer</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
