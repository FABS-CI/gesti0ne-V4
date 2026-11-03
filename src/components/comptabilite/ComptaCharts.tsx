import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { TableauDeBordCompta } from "@/lib/compta-api";
import { formatFCFA, formatFCFACompact } from "@/lib/format";

type Mensuel = TableauDeBordCompta["mensuel"];

// Couleurs des séries, validées (daltonisme, contraste) sur les fonds clair et sombre :
// produits = --chart-2 (vert), charges = --chart-1 (orange). Le vert est assombri en
// mode sombre pour rester dans la plage de luminosité lisible.
const SERIES_CLASS =
  "[--serie-produits:var(--chart-2)] [--serie-charges:var(--chart-1)] dark:[--serie-produits:oklch(0.65_0.13_160)]";

const MOIS = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];
const libelleMois = (m: string) => {
  const [a, mm] = m.split("-");
  return `${MOIS[Number(mm) - 1]} ${a.slice(2)}`;
};

const axe = { stroke: "var(--muted-foreground)", fontSize: 12, tickLine: false, axisLine: false };

function InfoBulle({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string; payload: Mensuel[number] }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold text-foreground">{label}</p>
      {payload.map((s) => (
        <p key={s.name} className="flex items-center gap-2 text-foreground">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: s.color }} />
          {s.name} : {formatFCFA(s.value)}
        </p>
      ))}
      {"resultat" in p && payload.length > 1 && (
        <p className="mt-1 border-t pt-1 text-muted-foreground">
          Résultat : {formatFCFA(p.resultat)}
        </p>
      )}
    </div>
  );
}

/** Produits et charges par mois (barres groupées, même échelle en FCFA). */
export function ProduitsChargesChart({ data }: { data: Mensuel }) {
  const points = data.map((d) => ({ ...d, label: libelleMois(d.mois) }));
  return (
    <div className={`h-full w-full ${SERIES_CLASS}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} barGap={2} barCategoryGap="25%">
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" {...axe} />
          <YAxis {...axe} width={56} tickFormatter={(v) => formatFCFACompact(v)} />
          <Tooltip content={<InfoBulle />} cursor={{ fill: "var(--muted)", opacity: 0.5 }} />
          <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
          <Bar
            dataKey="produits"
            name="Produits"
            fill="var(--serie-produits)"
            radius={[4, 4, 0, 0]}
          />
          <Bar dataKey="charges" name="Charges" fill="var(--serie-charges)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Chiffre d'affaires mensuel (comptes 70), une seule série. */
export function ChiffreAffairesChart({ data }: { data: Mensuel }) {
  const points = data.map((d) => ({ ...d, label: libelleMois(d.mois) }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={points}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" {...axe} />
        <YAxis {...axe} width={56} tickFormatter={(v) => formatFCFACompact(v)} />
        <Tooltip
          content={<InfoBulle />}
          cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
        />
        <Line
          type="monotone"
          dataKey="chiffre_affaires"
          name="Chiffre d'affaires"
          stroke="var(--chart-3)"
          strokeWidth={2}
          dot={{ r: 3, strokeWidth: 0, fill: "var(--chart-3)" }}
          activeDot={{ r: 5, stroke: "var(--card)", strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Répartition des charges par compte principal : barres horizontales triées. */
export function RepartitionCharges({ data }: { data: TableauDeBordCompta["charges_par_compte"] }) {
  const total = data.reduce((s, d) => s + Math.max(d.montant, 0), 0);
  const max = Math.max(...data.map((d) => d.montant), 1);
  if (data.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Aucune charge sur l&apos;exercice
      </p>
    );
  }
  return (
    <ul className={`space-y-2 ${SERIES_CLASS}`}>
      {data.map((d) => (
        <li key={d.compte} title={`${d.compte} — ${d.libelle} : ${formatFCFA(d.montant)}`}>
          <div className="mb-1 flex justify-between gap-2 text-xs">
            <span className="truncate text-foreground">
              <span className="font-mono text-muted-foreground">{d.compte}</span> {d.libelle}
            </span>
            <span className="shrink-0 font-medium text-foreground">
              {formatFCFA(d.montant)}
              {total > 0 && (
                <span className="ml-1 text-muted-foreground">
                  ({Math.round((Math.max(d.montant, 0) / total) * 100)} %)
                </span>
              )}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div
              className="h-2 rounded-full"
              style={{
                width: `${(Math.max(d.montant, 0) / max) * 100}%`,
                background: "var(--serie-charges)",
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
