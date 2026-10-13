import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AgregatDim } from "@/lib/rapports-api";
import { formatFCFA } from "@/lib/format";
import { formatAxisCompact, formatPct } from "@/lib/rapports-kpi";

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  fontSize: 12,
};
const SHADES = ["var(--primary)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--muted-foreground)"];

/** Barres horizontales classées ; répartition en barre empilée pour les catégories. */
export default function DimensionChart({
  rows,
  labelOf,
  stacked = false,
}: {
  rows: AgregatDim[];
  labelOf: (v: string) => string;
  stacked?: boolean;
}) {
  const sorted = [...rows].sort((a, b) => Number(b.ca) - Number(a.ca));
  const total = sorted.reduce((s, r) => s + Number(r.ca || 0), 0) || 1;

  if (stacked) {
    const top = sorted.slice(0, 5);
    const rest = sorted.slice(5).reduce((s, r) => s + Number(r.ca || 0), 0);
    const parts = [
      ...top.map((r) => ({ label: labelOf(r.label), ca: Number(r.ca || 0) })),
      ...(rest > 0 ? [{ label: "Autres", ca: rest }] : []),
    ];
    return (
      <div className="space-y-3 p-2">
        <div className="flex h-6 overflow-hidden rounded-md" role="img" aria-label="Répartition du CA par catégorie">
          {parts.map((p, i) => (
            <span
              key={p.label}
              title={`${p.label} : ${formatFCFA(p.ca)}`}
              style={{ width: `${(p.ca / total) * 100}%`, background: SHADES[i % SHADES.length] }}
            />
          ))}
        </div>
        <ul className="space-y-1.5 text-sm">
          {parts.map((p, i) => (
            <li key={p.label} className="flex items-center gap-2 tabular-nums">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SHADES[i % SHADES.length] }} />
              <span className="truncate">{p.label}</span>
              <span className="ml-auto text-muted-foreground">{formatPct((p.ca / total) * 100)}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const data = sorted.slice(0, 12).map((r) => ({ label: labelOf(r.label), ca: Number(r.ca || 0) }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 30 + 30)}>
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 12, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke="var(--border)" strokeOpacity={0.6} />
        <XAxis
          type="number"
          tickFormatter={formatAxisCompact}
          tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={130}
          tick={{ fontSize: 12, fill: "var(--foreground)" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "var(--muted)" }}
          contentStyle={tooltipStyle}
          formatter={(v) => [formatFCFA(Number(v)), "CA"]}
        />
        <Bar dataKey="ca" fill="var(--primary)" radius={[0, 3, 3, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
