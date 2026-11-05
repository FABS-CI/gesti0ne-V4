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
      <CardHeader className="flex flex-row items-center gap-3 space-y-0">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${def.color}1a`, color: def.color }}
        ></div>
        <CardTitle className="text-base">{def.label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{def.description}</p>
        <Button variant="outline" className="w-full" onClick={onExport} disabled={loading}>
          {loading ? "Export..." : "Exporter PDF"}
        </Button>
      </CardContent>
    </Card>
  );
}
