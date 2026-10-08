import { formatDate } from "@/lib/format";
import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Monitor, Smartphone, Tablet } from "lucide-react";
import {
  ACTION_LABEL,
  ACTION_VARIANT,
  BROWSER_STYLE,
  CRITICITE_STYLE,
  STATUS_STYLE,
  countryFlag,
  type AuditRow,
} from "@/lib/audit-helpers";

type Props = {
  rows: AuditRow[];
  isLoading: boolean;
  onSelect: (r: AuditRow) => void;
  onUserClick: (email: string) => void;
  page?: number;
  pageSize?: number;
  totalCount?: number;
  onPageChange?: (page: number) => void;
};

function DeviceIcon({ device }: { device?: string | null }) {
  if (device === "Mobile") return <Smartphone className="h-3.5 w-3.5" />;
  if (device === "Tablette") return <Tablet className="h-3.5 w-3.5" />;
  return <Monitor className="h-3.5 w-3.5" />;
}

const Row = React.memo(function Row({
  r,
  onSelect,
  onUserClick,
}: {
  r: AuditRow;
  onSelect: (r: AuditRow) => void;
  onUserClick: (email: string) => void;
}) {
  const crit = CRITICITE_STYLE[r.criticite ?? "info"] ?? CRITICITE_STYLE.info;
  const stat = STATUS_STYLE[r.status ?? "success"] ?? STATUS_STYLE.success;
  const localisation = [r.city, r.country].filter(Boolean).join(", ");
  const navigateur = [r.browser, r.browser_version].filter(Boolean).join(" ");
  return (
    <TableRow className="hover:bg-muted/40">
      <TableCell className="whitespace-nowrap text-xs">
        <div>{formatDate(r.occurred_at)}</div>
        <div className="text-muted-foreground">
          {new Date(r.occurred_at).toLocaleTimeString("fr-FR", { hour12: false })}
        </div>
      </TableCell>
      <TableCell>
        <button
          className="font-medium text-primary hover:underline"
          onClick={() => onUserClick(r.user_email ?? "")}
        >
          {r.user_email || "—"}
        </button>
      </TableCell>
      <TableCell>
        <Badge variant={ACTION_VARIANT(r.action)}>{ACTION_LABEL[r.action] ?? r.action}</Badge>
      </TableCell>
      <TableCell className="capitalize text-xs">{r.table_name}</TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground max-w-[180px] truncate">
        {r.record_ref ?? r.record_id ?? "—"}
      </TableCell>
      <TableCell>
        <span className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${stat.className}`}>
          {stat.label}
        </span>
      </TableCell>
      <TableCell>
        <span className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${crit.className}`}>
          {crit.label}
        </span>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <DeviceIcon device={r.device} />
          {r.browser ? (
            <span
              className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${
                BROWSER_STYLE[r.browser] ?? "bg-muted text-muted-foreground"
              }`}
              title={navigateur}
            >
              {r.browser}
              {r.browser_version ? ` ${r.browser_version.split(".")[0]}` : ""}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
        <div className="text-xs text-muted-foreground">{r.os ?? ""}</div>
      </TableCell>
      <TableCell className="text-xs">
        <div className="font-mono">{r.ip_address ?? "—"}</div>
        {(r.country_code || localisation) && (
          <div className="text-muted-foreground flex items-center gap-1">
            {r.country_code && <span className="text-sm leading-none">{countryFlag(r.country_code)}</span>}
            <span>{localisation || r.country_code}</span>
          </div>
        )}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {r.duration_ms != null ? `${r.duration_ms} ms` : "—"}
      </TableCell>
      <TableCell>
        <Button variant="ghost" size="sm" onClick={() => onSelect(r)}>
          <Eye className="mr-1 h-4 w-4" /> Détail
        </Button>
      </TableCell>
    </TableRow>
  );
});

export function ChronologieTab({
  rows,
  isLoading,
  onSelect,
  onUserClick,
  page,
  pageSize,
  totalCount,
  onPageChange,
}: Props) {
  const showPager = page && pageSize && totalCount !== undefined && onPageChange;
  const totalPages = showPager ? Math.max(1, Math.ceil(totalCount / pageSize)) : 1;

  const [deviceFilter, setDeviceFilter] = React.useState<string>("");
  const [countryFilter, setCountryFilter] = React.useState<string>("");
  const [browserFilter, setBrowserFilter] = React.useState<string>("");

  const devices = React.useMemo(
    () => Array.from(new Set(rows.map((r) => r.device).filter(Boolean))) as string[],
    [rows],
  );
  const countries = React.useMemo(
    () =>
      Array.from(
        new Set(
          rows
            .map((r) => (r.country_code ? `${r.country_code}|${r.country ?? r.country_code}` : null))
            .filter(Boolean) as string[],
        ),
      ),
    [rows],
  );
  const browsers = React.useMemo(
    () => Array.from(new Set(rows.map((r) => r.browser).filter(Boolean))) as string[],
    [rows],
  );

  const filteredRows = React.useMemo(() => {
    return rows.filter((r) => {
      if (deviceFilter && r.device !== deviceFilter) return false;
      if (countryFilter && r.country_code !== countryFilter) return false;
      if (browserFilter && r.browser !== browserFilter) return false;
      return true;
    });
  }, [rows, deviceFilter, countryFilter, browserFilter]);

  const hasSubFilter = !!(deviceFilter || countryFilter || browserFilter);

  return (
    <div className="rounded-lg border bg-card overflow-x-auto">
      <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-3 py-2 text-xs">
        <span className="text-muted-foreground">Filtrer :</span>
        <select
          className="rounded border bg-background px-2 py-1"
          value={deviceFilter}
          onChange={(e) => setDeviceFilter(e.target.value)}
        >
          <option value="">Tous appareils</option>
          {devices.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          className="rounded border bg-background px-2 py-1"
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
        >
          <option value="">Tous pays</option>
          {countries.map((c) => {
            const [code, name] = c.split("|");
            return (
              <option key={code} value={code}>
                {countryFlag(code)} {name}
              </option>
            );
          })}
        </select>
        <select
          className="rounded border bg-background px-2 py-1"
          value={browserFilter}
          onChange={(e) => setBrowserFilter(e.target.value)}
        >
          <option value="">Tous navigateurs</option>
          {browsers.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        {hasSubFilter && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7"
            onClick={() => {
              setDeviceFilter("");
              setCountryFilter("");
              setBrowserFilter("");
            }}
          >
            Réinitialiser
          </Button>
        )}
        {hasSubFilter && (
          <span className="ml-auto text-muted-foreground">
            {filteredRows.length} / {rows.length} sur cette page
          </span>
        )}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date / Heure</TableHead>
            <TableHead>Utilisateur</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Module</TableHead>
            <TableHead>Référence</TableHead>
            <TableHead>Résultat</TableHead>
            <TableHead>Niveau</TableHead>
            <TableHead>Appareil</TableHead>
            <TableHead>IP / Localisation</TableHead>
            <TableHead>Durée</TableHead>
            <TableHead className="w-24"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={11} className="py-10 text-center text-muted-foreground">
                Chargement…
              </TableCell>
            </TableRow>
          ) : filteredRows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={11} className="py-10 text-center text-muted-foreground">
                Aucun événement
              </TableCell>
            </TableRow>
          ) : (
            filteredRows.map((r) => (
              <Row key={r.id} r={r} onSelect={onSelect} onUserClick={onUserClick} />
            ))
          )}
        </TableBody>
      </Table>
      {showPager && totalCount > 0 && (
        <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
          <span>
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalCount)} sur {totalCount}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isLoading}
              onClick={() => onPageChange(page - 1)}
            >
              Précédent
            </Button>
            <span className="px-2 py-1">
              Page {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isLoading}
              onClick={() => onPageChange(page + 1)}
            >
              Suivant
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
