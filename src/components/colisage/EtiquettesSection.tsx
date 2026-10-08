import { Eye, ExternalLink, Printer, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EtiquetteCarton, type EtiquettePayload } from "@/components/colisage/EtiquetteCarton";
import { buildEtiquettesPrintHtml } from "@/lib/etiquette-html";
import { printEtiquettes } from "@/lib/print-etiquettes";

interface EtiquettesSectionProps {
  etiquettes: EtiquettePayload[];
  blReference: string;
}

export function EtiquettesSection({ etiquettes, blReference }: EtiquettesSectionProps) {
  const runAction = async (
    coliId: string | null | undefined,
    title: string,
    mode: "print" | "preview" | "download",
  ) => {
    const selected = coliId ? etiquettes.filter((e) => e.colis_id === coliId) : etiquettes;
    if (selected.length === 0) return;

    const html = await buildEtiquettesPrintHtml(selected);

    if (!html || html.trim() === "") {
      return;
    }

    if (mode === "download") {
      // Pour le téléchargement, on utilise le mode print (génère un PDF)
      printEtiquettes(html, title, "a4-portrait-auto", "print");
    } else {
      printEtiquettes(html, title, "a4-portrait-auto", mode);
    }
  };

  return (
    <Card className="shadow-sm border-primary/20">
      <CardHeader className="flex flex-row items-center justify-between print:hidden border-b pb-4">
        <div>
          <CardTitle className="text-xl font-bold text-primary">Étiquettes générées</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {etiquettes.length} étiquette{etiquettes.length > 1 ? 's' : ''} prête{etiquettes.length > 1 ? 's' : ''} pour l'impression
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="default"
            size="sm"
            className="bg-primary hover:bg-primary/90"
            onClick={(ev) => {
              ev.preventDefault();
              void runAction(null, `Étiquettes ${blReference}`, "print");
            }}
          >
            <Printer className="mr-2 h-4 w-4" /> Imprimer tout ({etiquettes.length})
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={(ev) => {
              ev.preventDefault();
              void runAction(null, `Aperçu étiquettes ${blReference}`, "preview");
            }}
          >
            <Eye className="mr-2 h-4 w-4" /> Aperçu global
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid gap-8 grid-cols-1 xl:grid-cols-2 print:grid-cols-1 print:gap-0">
          {etiquettes.map((e, i) => (
            <div key={i} className="flex flex-col items-center gap-6 p-6 rounded-xl bg-muted/20 border-2 border-muted-foreground/10 hover:border-primary/40 transition-all shadow-sm">
              <div className="w-full overflow-x-auto rounded-lg shadow-md border-2 bg-white p-6">
                <div className="mx-auto" style={{ width: "148.5mm", minHeight: "148.5mm" }}>
                  <EtiquetteCarton data={e} />
                </div>
              </div>
              
              <div className="flex flex-wrap items-center justify-center gap-4 w-full pt-4 border-t-2 border-muted-foreground/10">
                <Button
                  variant="default"
                  size="default"
                  className="flex-1 min-w-[140px] bg-primary hover:bg-primary/90 shadow-sm"
                  onClick={(ev) => {
                    ev.preventDefault();
                    void runAction(
                      e.colis_id,
                      `Impression Sticker ${blReference} - Carton ${e.numero_carton}/${e.nb_cartons}`,
                      "print",
                    );
                  }}
                >
                  <Printer className="mr-2 h-5 w-5" /> Imprimer
                </Button>

                <Button
                  variant="secondary"
                  size="default"
                  className="flex-1 min-w-[140px] shadow-sm"
                  onClick={(ev) => {
                    ev.preventDefault();
                    void runAction(
                      e.colis_id,
                      `Aperçu Sticker ${blReference} - Carton ${e.numero_carton}/${e.nb_cartons}`,
                      "preview",
                    );
                  }}
                >
                  <Eye className="mr-2 h-5 w-5" /> Aperçu
                </Button>

                <Button
                  variant="outline"
                  size="default"
                  className="flex-1 min-w-[140px] border-2"
                  onClick={(ev) => {
                    ev.preventDefault();
                    void runAction(
                      e.colis_id,
                      `Téléchargement Sticker ${blReference} - Carton ${e.numero_carton}/${e.nb_cartons}`,
                      "download",
                    );
                  }}
                >
                  <Download className="mr-2 h-5 w-5" /> Télécharger
                </Button>

                {e.colis_id && (
                  <Button
                    variant="ghost"
                    size="default"
                    className="flex-1 min-w-[140px] hover:bg-primary/10 hover:text-primary transition-colors border-2 border-transparent hover:border-primary/20"
                    onClick={(ev) => {
                      ev.preventDefault();
                      window.open(`/carton/${e.colis_id}`, "_blank");
                    }}
                  >
                    <ExternalLink className="mr-2 h-5 w-5" /> Tracking
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
