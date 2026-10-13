import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SerieTemp } from "@/lib/rapports-api";
import { formatFCFA } from "@/lib/format";
import { formatAxisCompact } from "@/lib/rapports-kpi";

type Point = { periode: string; ca: number; prev?: number; prevPeriode?: string };

/** Courbe du CA ; période précédente en pointillé gris, alignée par rang. */
export default function EvolutionChart({
  data,
  previous,
}: {
  data: SerieTemp[];
  previous?: SerieTemp[];
}) {
  const points: Point[] = data.map((d, i) => ({
    periode: d.periode,
    ca: Number(d.ca ?? 0),
    prev: previous?.[i] ? Number(previous[i].ca ?? 0) : undefined,
    prevPeriode: previous?.[i]?.periode,
  }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
        <XAxis
          dataKey="periode"
          tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={false}
          minTickGap={16}
        />
        <YAxis
          tickFormatter={formatAxisCompact}
          tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={false}
          width={56}
        />
        <Tooltip
          cursor={{ stroke: "var(--border)" }}
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            fontSize: 12,
          }}
          labelStyle={{ color: "var(--foreground)", fontWeight: 600 }}
          formatter={(value, name, item) => {
            const p = item?.payload as Point | undefined;
            return [
              formatFCFA(Number(value)),
              name === "prev" ? `Période précédente${p?.prevPeriode ? ` (${p.prevPeriode})` : ""}` : "CA",
            ];
          }}
        />
        <Area
          type="monotone"
          dataKey="ca"
          name="ca"
          stroke="var(--primary)"
          strokeWidth={2}
          fill="var(--primary)"
          fillOpacity={0.08}
          isAnimationActive={false}
          dot={false}
        />
        {previous && (
          <Line
            type="monotone"
            dataKey="prev"
            name="prev"
            stroke="var(--muted-foreground)"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}
