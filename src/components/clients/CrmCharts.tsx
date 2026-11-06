import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CrmDashboard } from "@/lib/crm-api";
import { formatFCFA } from "@/lib/format";

const COLORS = ["var(--chart-1)","var(--chart-2)","var(--chart-3)","var(--chart-4)","var(--chart-5)"];

export default function CrmCharts({ data }: { data: CrmDashboard }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="CA mensuel">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data.ca_mensuel}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`}
            />
            <Tooltip formatter={(v: number) => formatFCFA(v)} />
            <Line type="monotone" dataKey="ca" stroke="var(--chart-1)" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Répartition par type de client">
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={data.par_type_client}
              dataKey="ca"
              nameKey="label"
              cx="50%"
              cy="50%"
              outerRadius={90}
              label={(e) => e.label}
            >
              {data.par_type_client.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number) => formatFCFA(v)} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Ventes par niveau scolaire">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data.par_niveau}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => formatFCFA(v)} />
            <Bar dataKey="ca" fill="var(--chart-3)" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Ventes par catégorie">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data.par_categorie} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              type="number"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            />
            <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={140} />
            <Tooltip formatter={(v: number) => formatFCFA(v)} />
            <Bar dataKey="ca" fill="var(--chart-1)" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Top villes (CA)">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data.par_ville.slice(0, 10)} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              type="number"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            />
            <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={110} />
            <Tooltip formatter={(v: number) => formatFCFA(v)} />
            <Bar dataKey="ca" fill="var(--chart-2)" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Top produits (quantités)">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data.top_produits.slice(0, 10)} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={160} />
            <Tooltip />
            <Legend />
            <Bar dataKey="qte" name="Quantité" fill="var(--chart-4)" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
