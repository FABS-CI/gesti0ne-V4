import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Circle,
  Download,
  ChevronLeft,
  ChevronRight,
  Smartphone,
  Monitor,
  Tablet,
  MapPin,
} from "lucide-react";
import { ACTION_LABEL } from "@/lib/audit-helpers";

export type ConnectedUser = {
  email: string;
  user_id: string | null;
  last: string;
  last_action: string;
  ip: string | null;
  count: number;
  device?: string | null;
  browser?: string | null;
  os?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  country_code?: string | null;
  isp?: string | null;
  lat?: number | null;
  lon?: number | null;
  nom_complet?: string | null;
  prenom?: string | null;
  fonction?: string | null;
  connected_at?: string | null;
  is_live?: boolean;
};

type Props = {
  onlineSearch: string;
  setOnlineSearch: (v: string) => void;
  onlineIp: string;
  setOnlineIp: (v: string) => void;
  onlineWindowMin: number;
  setOnlineWindowMin: (v: number) => void;
  refreshSec: number;
  setRefreshSec: (v: number) => void;
  filteredConnected: ConnectedUser[];
  onlinePageRows: ConnectedUser[];
  onlinePageSafe: number;
  onlineTotalPages: number;
  onlinePageSize: number;
  setOnlinePage: (updater: (p: number) => number) => void;
  nowTick: number;
  onSelectUser: (email: string) => void;
  onExportCsv: () => void;
  onExportPDF: () => void;
};

const Row = React.memo(function Row({
  u,
  nowTick,
  onSelectUser,
}: {
  u: ConnectedUser;
  nowTick: number;
  onSelectUser: (email: string) => void;
}) {
  const ageMin = Math.max(0, Math.floor((nowTick - new Date(u.last).getTime()) / 60000));
  const DeviceIcon =
    u.device === "Mobile" ? Smartphone : u.device === "Tablette" ? Tablet : Monitor;
  const loc = [u.city, u.region, u.country].filter(Boolean).join(", ");
  const mapsHref =
    u.lat != null && u.lon != null
      ? `https://www.google.com/maps?q=${u.lat},${u.lon}`
      : u.ip
        ? `https://www.google.com/maps?q=${encodeURIComponent(loc || u.ip)}`
        : null;
  // Statut : présence websocket → En ligne ; inactif si >5 min sans activité ;
  // sinon Hors ligne (audit-only, plus de socket).
  const statut: "online" | "idle" | "offline" = u.is_live
    ? ageMin >= 5
      ? "idle"
      : "online"
    : "offline";
  const displayName =
    [u.prenom, u.nom_complet].filter(Boolean).join(" ").trim() || u.email;
  return (
    <TableRow>
      <TableCell className="font-medium">
        <button className="text-primary hover:underline" onClick={() => onSelectUser(u.email)}>
          {displayName}
        </button>
        <div className="text-xs text-muted-foreground">
          {u.email}
          {u.fonction ? ` · ${u.fonction}` : ""}
        </div>
        {u.connected_at && (
          <div className="text-[10px] text-muted-foreground">
            Depuis {new Date(u.connected_at).toLocaleTimeString("fr-FR")}
          </div>
        )}
      </TableCell>
      <TableCell>
        {statut === "online" ? (
          <Badge className="gap-1 bg-success hover:bg-success">
            <Circle className="h-2 w-2 fill-white text-white" />
            En ligne
          </Badge>
        ) : statut === "idle" ? (
          <Badge className="gap-1 bg-warning hover:bg-warning">
            <Circle className="h-2 w-2 fill-white text-white" />
            Inactif
          </Badge>
        ) : (
          <Badge variant="secondary" className="gap-1">
            <Circle className="h-2 w-2 fill-destructive text-destructive" />
            Hors ligne
          </Badge>
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
        {ACTION_LABEL[u.last_action] ?? u.last_action} · il y a {ageMin} min
      </TableCell>
      <TableCell className="text-xs">
        <div className="font-mono">{u.ip ?? "—"}</div>
        {(loc || u.isp) && (
          <div className="mt-0.5 flex items-center gap-1 text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {mapsHref ? (
              <a href={mapsHref} target="_blank" rel="noreferrer" className="hover:underline">
                {loc || "—"}
              </a>
            ) : (
              <span>{loc || "—"}</span>
            )}
            {u.isp && <span className="ml-1 opacity-70">· {u.isp}</span>}
          </div>
        )}
      </TableCell>
      <TableCell className="text-xs">
        <div className="flex items-center gap-1">
          <DeviceIcon className="h-3.5 w-3.5" />
          <span>{u.device ?? "—"}</span>
        </div>
        <div className="text-muted-foreground">
          {u.browser ?? "—"}
          {u.os ? ` · ${u.os}` : ""}
        </div>
      </TableCell>
      <TableCell className="text-right font-mono">{u.count}</TableCell>
      <TableCell>
        <Button variant="outline" size="sm" onClick={() => onSelectUser(u.email)}>
          Fiche
        </Button>
      </TableCell>
    </TableRow>
  );
});

export function OnlineTab(p: Props) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex flex-col gap-3 border-b p-3 md:flex-row md:flex-wrap md:items-center">
        <div className="text-xs text-muted-foreground md:mr-auto">
          Utilisateurs actifs sur les {p.onlineWindowMin} dernières minutes.
        </div>
        <Input
          placeholder="Rechercher un utilisateur…"
          value={p.onlineSearch}
          onChange={(e) => {
            p.setOnlineSearch(e.target.value);
            p.setOnlinePage(() => 1);
          }}
          className="w-full md:w-56"
        />
        <Input
          placeholder="Filtrer par IP…"
          value={p.onlineIp}
          onChange={(e) => {
            p.setOnlineIp(e.target.value);
            p.setOnlinePage(() => 1);
          }}
          className="w-full md:w-40"
        />
        <Select
          value={String(p.onlineWindowMin)}
          onValueChange={(v) => p.setOnlineWindowMin(Number(v))}
        >
          <SelectTrigger className="w-full md:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="5">Seuil : 5 min</SelectItem>
            <SelectItem value="15">Seuil : 15 min</SelectItem>
            <SelectItem value="30">Seuil : 30 min</SelectItem>
            <SelectItem value="60">Seuil : 60 min</SelectItem>
          </SelectContent>
        </Select>
        <Select value={String(p.refreshSec)} onValueChange={(v) => p.setRefreshSec(Number(v))}>
          <SelectTrigger className="w-full md:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">Actualiser : 10 s</SelectItem>
            <SelectItem value="30">Actualiser : 30 s</SelectItem>
            <SelectItem value="60">Actualiser : 60 s</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={p.onExportCsv}>
          <Download className="mr-2 h-4 w-4" /> Exporter
        </Button>
        <Button variant="outline" size="sm" onClick={p.onExportPDF} aria-label="Exporter PDF">
          <Download className="mr-2 h-4 w-4" /> PDF
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Utilisateur</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Dernière action</TableHead>
            <TableHead>IP / Localisation</TableHead>
            <TableHead>Appareil</TableHead>
            <TableHead className="text-right">Actions ({p.onlineWindowMin} min)</TableHead>
            <TableHead className="w-32"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {p.filteredConnected.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                Aucun utilisateur connecté actuellement
              </TableCell>
            </TableRow>
          ) : (
            p.onlinePageRows.map((u) => (
              <Row
                key={u.email + (u.user_id ?? "")}
                u={u}
                nowTick={p.nowTick}
                onSelectUser={p.onSelectUser}
              />
            ))
          )}
        </TableBody>
      </Table>
      {p.filteredConnected.length > p.onlinePageSize && (
        <div className="flex items-center justify-between border-t p-3 text-sm">
          <div className="text-muted-foreground">
            Page {p.onlinePageSafe} / {p.onlineTotalPages} — {p.filteredConnected.length}{" "}
            utilisateur(s)
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={p.onlinePageSafe <= 1}
              onClick={() => p.setOnlinePage((x) => Math.max(1, x - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={p.onlinePageSafe >= p.onlineTotalPages}
              onClick={() => p.setOnlinePage((x) => Math.min(p.onlineTotalPages, x + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
