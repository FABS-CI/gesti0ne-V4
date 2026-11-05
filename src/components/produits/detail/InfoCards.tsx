import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatFCFA } from "@/lib/format";
import { usePermissions } from "@/hooks/use-permissions";

interface Props {
  isbn: string | null;
  prix_vente: number;
  prix_achat: number;
  seuil_alerte: number;
}

export function InfoCards({ isbn, prix_vente, prix_achat, seuil_alerte }: Props) {
  const { has } = usePermissions();
  const canSeePrix = has("produits.voir_prix");
  const canSeeCouts = has("produits.voir_couts");
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
            ISBN
          </CardTitle>
        </CardHeader>
        <CardContent className="font-medium">{isbn ?? "—"}</CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
            Prix vente
          </CardTitle>
        </CardHeader>
        <CardContent className="font-medium text-primary">
          {canSeePrix ? formatFCFA(prix_vente) : "—"}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
            Prix achat
          </CardTitle>
        </CardHeader>
        <CardContent className="font-medium">
          {canSeeCouts ? formatFCFA(prix_achat) : "—"}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
            Seuil alerte
          </CardTitle>
        </CardHeader>
        <CardContent className="font-medium">{seuil_alerte}</CardContent>
      </Card>
    </div>
  );
}
