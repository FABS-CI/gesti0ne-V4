import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PdfOpts } from "@/lib/paie-declarations-helpers";
import { Can } from "@/components/rbac/Can";

type Props = {
  periode: string;
  onPeriodeChange: (v: string) => void;
  periodesList: string[];
  disabled: boolean;
  cnps: PdfOpts;
  its: PdfOpts;
  disa: PdfOpts;
  onPreview: (o: PdfOpts) => void;
  onDownload: (o: PdfOpts) => void;
};

export function DeclarationsToolbar({
  periode,
  onPeriodeChange,
  periodesList,
  disabled,
  cnps,
  its,
  disa,
  onPreview,
  onDownload,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Période de déclaration</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-4">
        <div className="min-w-[220px]">
          <Label>Période</Label>
          <Select value={periode} onValueChange={onPeriodeChange}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner une période" />
            </SelectTrigger>
            <SelectContent>
              {periodesList.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          <Can permission="paie.declarer_cnps">
            <Button onClick={() => onPreview(cnps)} disabled={disabled} variant="outline">
              <Eye className="mr-2 h-4 w-4" /> Aperçu CNPS
            </Button>
            <Button onClick={() => onDownload(cnps)} disabled={disabled} variant="secondary">
              CNPS (PDF)
            </Button>
          </Can>
          <Can permission="paie.declarer_its">
            <Button onClick={() => onPreview(its)} disabled={disabled} variant="outline">
              <Eye className="mr-2 h-4 w-4" /> Aperçu ITS+CN
            </Button>
            <Button onClick={() => onDownload(its)} disabled={disabled} variant="secondary">
              ITS + CN (PDF)
            </Button>
          </Can>
          <Can permission="paie.declarer_fdfp">
            <Button onClick={() => onPreview(disa)} disabled={disabled} variant="outline">
              <Eye className="mr-2 h-4 w-4" /> Aperçu DISA
            </Button>
            <Button onClick={() => onDownload(disa)} disabled={disabled}>
              DISA (PDF)
            </Button>
          </Can>
        </div>
      </CardContent>
    </Card>
  );
}
