import { Download, Eye, FileArchive, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  societeNom: string;
  ecrituresCount: number;
  previewLines: string[];
  isLoading: boolean;
  canDownload: boolean;
  zipPending: boolean;
  onDownloadFec: () => void;
  onGenerateZip: () => void;
  onCancelZip: () => void;
}

export function FecPreviewCard({
  societeNom,
  ecrituresCount,
  previewLines,
  isLoading,
  canDownload,
  zipPending,
  onDownloadFec,
  onGenerateZip,
  onCancelZip,
}: Props) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="h-4 w-4" /> Aperçu FEC
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {societeNom} · {ecrituresCount} écriture(s) ·{" "}
            {previewLines.length
              ? `${Math.max(0, previewLines.length - 1)} lignes affichées`
              : "aucune donnée"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onDownloadFec} disabled={!canDownload || isLoading}>
            <Download className="mr-2 h-4 w-4" /> FEC (.txt)
          </Button>
          <Button onClick={onGenerateZip} disabled={!canDownload || zipPending}>
            {zipPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileArchive className="mr-2 h-4 w-4" />
            )}
            ZIP (FEC + Balance + Grand livre + Journal)
          </Button>
          {zipPending && (
            <Button variant="destructive" onClick={onCancelZip}>
              <X className="mr-2 h-4 w-4" /> Annuler
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
          </p>
        ) : previewLines.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune écriture sur cette période — rien à exporter.
          </p>
        ) : (
          <pre className="text-xs leading-relaxed bg-muted/40 rounded-md p-3 overflow-auto max-h-72 font-mono">
            {previewLines.join("\n")}
            {"\n"}…
          </pre>
        )}
      </CardContent>
    </Card>
  );
}
