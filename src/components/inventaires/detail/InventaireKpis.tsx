import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatFCFA } from "@/lib/format";

type Props = {
  nbLignes: number;
  nbEcarts: number;
  valeur: number;
  editable: boolean;
  createdByNom: string | null;
};

export function InventaireKpis({ nbLignes, nbEcarts, valeur, editable, createdByNom }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Produits</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-bold">{nbLignes}</CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Écarts {editable ? "(prévisualisation)" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-bold text-warning">{nbEcarts}</CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Valeur comptée
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xl font-bold">{formatFCFA(valeur)}</CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Créé par</CardTitle>
        </CardHeader>
        <CardContent className="text-base font-medium">{createdByNom ?? "—"}</CardContent>
      </Card>
    </div>
  );
}
