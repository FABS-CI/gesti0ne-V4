import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FEC_HEADERS } from "@/lib/fec-helpers";

export function FecColonnesCard() {
  const copyColumnsOrder = async () => {
    const text = FEC_HEADERS.map((h, i) => `${String(i + 1).padStart(2, "0")}. ${h}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Ordre des 18 colonnes copié");
    } catch {
      toast.error("Impossible d'accéder au presse-papiers");
    }
  };
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Colonnes générées (18)</CardTitle>
        <Button size="sm" variant="outline" onClick={copyColumnsOrder}>
          Copier ordre colonnes
        </Button>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-3">
          Ordre exact des colonnes du fichier (séparateur « | »). Vérifiez la correspondance avant
          téléchargement.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {FEC_HEADERS.map((h, i) => (
            <div
              key={h}
              className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1 text-xs"
            >
              <span className="font-mono text-muted-foreground w-5 text-right">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="font-medium truncate">{h}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
