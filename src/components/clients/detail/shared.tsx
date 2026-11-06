import React from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useReportANouveau } from "@/hooks/use-report-a-nouveau";
import { formatFCFA } from "@/lib/format";

export function EmptyRow({ cols, label }: { cols: number; label: string }) {
  return (
    <TableRow>
      <TableCell colSpan={cols} className="py-10 text-center text-muted-foreground">
        {label}
      </TableCell>
    </TableRow>
  );
}

export function Info({
  icon,
  label,
  value,
  testId,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string | null | undefined;
  testId?: string;
}) {
  return (
    <div data-testid={testId}>
      <p className="flex items-center gap-1.5 text-sm font-medium">
        {icon}
        {label}
      </p>
      <p className="text-sm text-muted-foreground">{value || "—"}</p>
    </div>
  );
}

export function Kpi({
  label,
  value,
  accent,
  color,
  className,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  accent?: string;
  color?: string;
  className?: string;
  onClick?: () => void;
}) {
  void color;
  return (
    <Card className={className || ""} onClick={onClick}>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className={`text-xl font-semibold tabular-nums tracking-tight ${accent ?? ""}`}>
        {value}
      </CardContent>
    </Card>
  );
}

export function ReportANouveauKpi({ clientId }: { clientId: string }) {
  const { data } = useReportANouveau("client", clientId);
  const m = data?.montant ?? 0;
  const label = m < 0 ? "Report à-nouveau (avance)" : "Report à-nouveau";
  const accent = m > 0 ? "text-destructive" : m < 0 ? "text-success" : undefined;
  return <Kpi label={label} value={formatFCFA(Math.abs(m))} accent={accent} />;
}
