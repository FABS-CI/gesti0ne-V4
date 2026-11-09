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
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
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
          animationDuration={900}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Facturé par mois : barres arrondies en haut, quadrillage léger. */
export function CABarChart({ data }: { data: CAPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} barCategoryGap="30%">
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="2 4" />
        <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis
          stroke="var(--muted-foreground)"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={(v) => formatFCFACompact(v)}
        />
        <Tooltip cursor={{ fill: "var(--surface-subtle)" }} formatter={(v: number) => formatFCFA(v)} />
        <Bar dataKey="ca" name="Facturé" fill="var(--primary)" radius={[6, 6, 0, 0]} maxBarSize={36} animationDuration={800} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CommandesBarChart({ data }: { data: CAPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip />
        <Bar
          dataKey="nb"
          name="Commandes"
          fill="var(--chart-soft)"
          radius={[6, 6, 0, 0]}
          animationDuration={800}
          animationEasing="ease-out"
        />
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
          animationDuration={800}
          animationEasing="ease-out"
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
