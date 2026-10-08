import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye } from "lucide-react";
import type { PdfTemplate, PdfTemplateId } from "@/lib/pdf/pdfConfig";
import type { DocType, DocumentSettings } from "@/lib/document-settings-api";
import { DOC_TYPES } from "@/lib/modeles-documents-helpers";

type Props = {
  settings: DocumentSettings;
  templates: PdfTemplate[];
  onLogoFile: (file: File | null) => void;
  setTemplateForType: (type: DocType, id: PdfTemplateId | "_default") => void;
  onApercuCycle: () => void;
};

export function LogoAndPerTypeCard({
  settings,
  templates,
  onLogoFile,
  setTemplateForType,
  onApercuCycle,
}: Props) {
  return (
    <Card className="space-y-4 p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold">Logo & application par type de document</h2>
        <p className="text-xs text-muted-foreground">
          Le logo et un modèle spécifique peuvent être définis pour chaque type. Sans choix, le
          modèle global ci-dessous est utilisé.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3">
          {settings.logo_url ? (
            <img
              src={settings.logo_url}
              alt="Logo"
              className="h-14 w-14 rounded border bg-white object-contain p-1"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded border bg-muted text-xs text-muted-foreground">
              Aucun
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">Logo (PNG/JPG, max 512 Ko)</Label>
            <Input
              type="file"
              accept="image/png,image/jpeg,image/svg+xml"
              onChange={(e) => onLogoFile(e.target.files?.[0] ?? null)}
              className="h-8 text-xs"
            />
          </div>
          {settings.logo_url && (
            <Button size="sm" variant="outline" onClick={() => onLogoFile(null)}>
              Retirer
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {DOC_TYPES.map(([type, label]) => (
          <div key={type} className="space-y-1">
            <Label className="text-xs">{label}</Label>
            <Select
              value={settings.template_per_type[type] ?? "_default"}
              onValueChange={(v) => setTemplateForType(type, v as PdfTemplateId | "_default")}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_default">Modèle global</SelectItem>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 border-t pt-3">
        <Button size="sm" variant="outline" onClick={onApercuCycle}>
          <Eye className="mr-1 h-4 w-4" /> Aperçu regroupement cycle (PDF)
        </Button>
      </div>
    </Card>
  );
}
