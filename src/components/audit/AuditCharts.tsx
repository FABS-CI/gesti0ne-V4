import { formatDayMonth } from "@/lib/format";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";

type ModuleRow = { module: string; total: number };

export function AuditCharts({ days = 30 }: { days?: number }) {
  const daily = useQuery({
    queryKey: ["audit-daily", days],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("audit_events_daily", { p_days: days });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        day: formatDayMonth(r.day),
        info: Number(r.info),
        warning: Number(r.warning),
        critical: Number(r.error),
      }));
    },
    retry: false,
  });

  const byModule = useQuery({
    queryKey: ["audit-by-module", days],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("audit_events_by_module", { p_days: days });
      if (error) throw error;
      return (data ?? []).map((r: ModuleRow) => ({ ...r, total: Number(r.total) }));
    },
    retry: false,
  });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-lg border p-4">
        <div className="mb-2 text-sm font-semibold">Activité sur {days} jours</div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={daily.data ?? []}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Area type="monotone" dataKey="info" stackId="1" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.4} />
              <Area type="monotone" dataKey="warning" stackId="1" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.5} />
              <Area type="monotone" dataKey="critical" stackId="1" stroke="#EF4444" fill="#EF4444" fillOpacity={0.6} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <div className="mb-2 text-sm font-semibold">Top modules</div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byModule.data ?? []} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="module" tick={{ fontSize: 11 }} width={120} />
              <Tooltip />
              <Bar dataKey="total" fill="#F97316" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}