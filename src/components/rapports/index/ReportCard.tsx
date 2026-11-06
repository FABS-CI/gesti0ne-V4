import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReportDef } from "@/lib/rapports-index-helpers";

type Props = {
  def: ReportDef;
  loading: boolean;
  onExport: () => void;
};

export function ReportCard({ def, loading, onExport }: Props) {
  return (
    <Card>
      <CardHeader className="space-y-0 pb-2">
        <CardTitle className="text-base">{def.label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{def.description}</p>
        <Button variant="outline" className="w-full" onClick={onExport} disabled={loading}>
          <Download className="mr-2 h-4 w-4" />
          {loading ? "Export..." : "Exporter PDF"}
        </Button>
      </CardContent>
    </Card>
  );
}
