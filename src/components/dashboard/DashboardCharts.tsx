import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  AreaChart,
  Area,
} from "recharts";
import { formatFCFA, formatFCFACompact } from "@/lib/format";

type CAPoint = { name: string; ca: number; nb: number };
type StatutPoint = { statut: string; count: number };

export function CAAreaChart({ data }: { data: CAPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="caGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.12} />
            <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} />
        <YAxis
          stroke="var(--muted-foreground)"
          fontSize={12}
          tickFormatter={(v) => formatFCFACompact(v)}
        />
        <Tooltip formatter={(v: number) => formatFCFA(v)} />
        <Area
          type="monotone"
          dataKey="ca"
          name="CA"
          stroke="var(--primary)"
          strokeWidth={2}
          fill="url(#caGrad)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function CommandesBarChart({ data }: { data: CAPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} />
        <YAxis stroke="var(--muted-foreground)" fontSize={12} allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="nb" name="Commandes" fill="var(--info)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StatutPieChart({
  data,
  colors,
}: {
  data: StatutPoint[];
  colors: Record<string, string>;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="statut"
          innerRadius={50}
          outerRadius={85}
          paddingAngle={2}
        >
          {data.map((s) => (
            <Cell key={s.statut} fill={colors[s.statut] ?? "var(--muted-foreground)"} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}
