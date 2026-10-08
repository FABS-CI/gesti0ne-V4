import { formatDateTime } from "@/lib/format";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  ACTION_LABEL,
  ACTION_VARIANT,
  BROWSER_STYLE,
  CRITICITE_STYLE,
  STATUS_STYLE,
  countryFlag,
  diffAuditValues,
  type AuditRow,
} from "@/lib/audit-helpers";

type Props = { selected: AuditRow | null; onClose: () => void };

function Meta({
  label,
  value,
  className,
}: {
  label: string;
  value: string | null | undefined;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="truncate font-mono text-xs">{value || "—"}</div>
    </div>
  );
}

export function EventDetailDialog({ selected, onClose }: Props) {
  return (
    <Dialog open={!!selected} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Détail de l'événement</DialogTitle>
          <DialogDescription asChild>
            {selected ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span>{formatDateTime(selected.occurred_at)}</span>
                <span>·</span>
                <span className="font-medium">{selected.user_email || "—"}</span>
                <span>·</span>
                <Badge variant={ACTION_VARIANT(selected.action)}>
                  {ACTION_LABEL[selected.action] ?? selected.action}
                </Badge>
                <span>
                  sur <span className="capitalize">{selected.table_name}</span>
                </span>
              </div>
            ) : (
              <span />
            )}
          </DialogDescription>
        </DialogHeader>
        {selected && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid grid-cols-2 gap-2 text-xs sm:col-span-2">
              <Meta label="Module" value={selected.module ?? selected.table_name} />
              <Meta label="Référence" value={selected.record_ref ?? selected.record_id} />
              <Meta label="URL" value={selected.url} />
              <Meta label="Méthode" value={selected.http_method} />
              <Meta label="Adresse IP" value={selected.ip_address} />
              <Meta
                label="Durée"
                value={selected.duration_ms != null ? `${selected.duration_ms} ms` : null}
              />
              <div>
                <div className="text-xs text-muted-foreground">
                  Statut
                </div>
                <div className="font-mono text-xs">
                  {selected.status ? (
                    <span
                      className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${
                        STATUS_STYLE[selected.status]?.className ?? ""
                      }`}
                    >
                      {STATUS_STYLE[selected.status]?.label ?? selected.status}
                    </span>
                  ) : (
                    "—"
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">
                  Niveau
                </div>
                <div className="font-mono text-xs">
                  {selected.criticite ? (
                    <span
                      className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${
                        CRITICITE_STYLE[selected.criticite]?.className ?? ""
                      }`}
                    >
                      {CRITICITE_STYLE[selected.criticite]?.label ?? selected.criticite}
                    </span>
                  ) : (
                    "—"
                  )}
                </div>
              </div>
              <div className="col-span-2 rounded border bg-muted/20 p-2">
                <div className="mb-1 text-xs text-muted-foreground">
                  Appareil / Localisation
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {selected.browser && (
                    <span
                      className={`inline-flex rounded px-1.5 py-0.5 font-medium ${
                        BROWSER_STYLE[selected.browser] ?? "bg-muted text-muted-foreground"
                      }`}
                    >
                      {selected.browser} {selected.browser_version ?? ""}
                    </span>
                  )}
                  {selected.os && (
                    <span className="inline-flex rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                      {selected.os}
                    </span>
                  )}
                  {selected.device && (
                    <span className="inline-flex rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                      {selected.device}
                    </span>
                  )}
                  {selected.country_code && (
                    <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5">
                      <span className="text-sm leading-none">
                        {countryFlag(selected.country_code)}
                      </span>
                      {[selected.city, selected.country].filter(Boolean).join(", ") ||
                        selected.country_code}
                    </span>
                  )}
                  {selected.screen_resolution && (
                    <span className="text-muted-foreground">
                      Écran : {selected.screen_resolution}
                    </span>
                  )}
                  {selected.timezone && (
                    <span className="text-muted-foreground">Fuseau : {selected.timezone}</span>
                  )}
                </div>
              </div>
              <Meta label="Session" value={selected.session_id} />
              <Meta label="Corrélation" value={selected.correlation_id} />
              <Meta label="User agent" value={selected.user_agent} className="col-span-2" />
              {selected.error_message && (
                <Meta label="Erreur" value={selected.error_message} className="col-span-2" />
              )}
            </div>
            {selected.changes ? (
              <div className="sm:col-span-2">
                <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                  Champs modifiés
                </div>
                <ScrollArea className="h-40 rounded border bg-muted/30 p-3">
                  <pre className="text-xs">{JSON.stringify(selected.changes, null, 2)}</pre>
                </ScrollArea>
              </div>
            ) : null}
            {(() => {
              const diff = diffAuditValues(selected.old_values, selected.new_values);
              if (diff.length === 0) return null;
              return (
                <div className="sm:col-span-2">
                  <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                    Résumé des changements ({diff.length})
                  </div>
                  <ScrollArea className="max-h-48 rounded border bg-muted/30">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="px-2 py-1 font-medium">Champ</th>
                          <th className="px-2 py-1 font-medium">Avant</th>
                          <th className="px-2 py-1 font-medium">Après</th>
                        </tr>
                      </thead>
                      <tbody>
                        {diff.map((d) => (
                          <tr key={d.champ} className="border-b last:border-0">
                            <td className="px-2 py-1 font-mono">{d.champ}</td>
                            <td className="px-2 py-1 break-all">{d.avant}</td>
                            <td className="px-2 py-1 break-all font-medium">{d.apres}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                </div>
              );
            })()}
            <div>
              <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                Avant
              </div>
              <ScrollArea className="h-80 rounded border bg-muted/30 p-3">
                <pre className="text-xs">
                  {selected.old_values ? JSON.stringify(selected.old_values, null, 2) : "—"}
                </pre>
              </ScrollArea>
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                Après
              </div>
              <ScrollArea className="h-80 rounded border bg-muted/30 p-3">
                <pre className="text-xs">
                  {selected.new_values ? JSON.stringify(selected.new_values, null, 2) : "—"}
                </pre>
              </ScrollArea>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
