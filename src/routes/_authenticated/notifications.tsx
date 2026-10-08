import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, CheckCheck, RefreshCw, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { NotificationPreferencesPanel } from "@/components/NotificationPreferencesPanel";

import {
  TYPE_LABEL,
  deleteAllRead,
  deleteNotification,
  genererAlertes,
  listNotifications,
  markAllAsRead,
  markAsRead,
  type Notification,
} from "@/lib/notifications-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useConfirmDelete } from "@/hooks/use-confirm-delete";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/common/EmptyState";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { friendlyError } from '@/lib/friendly-error';

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsCentre,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function frDateTime(d: string) {
  try {
    return new Date(d).toLocaleString("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return d;
  }
}

function NotificationsCentre() {
  const { confirm, dialog: confirmDialog } = useConfirmDelete();
  const qc = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [luFilter, setLuFilter] = useState<string>("all");

  const {
    data: notifs = [],
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["notifications", typeFilter, luFilter],
    queryFn: () =>
      listNotifications({
        type: typeFilter === "all" ? undefined : typeFilter,
        lu: luFilter === "all" ? undefined : luFilter === "lu",
      }),
  });

  const stats = useMemo(() => {
    const total = notifs.length;
    const nonLus = notifs.filter((n) => !n.lu).length;
    return { total, nonLus };
  }, [notifs]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["notifications"] });
    qc.invalidateQueries({ queryKey: ["notifications-unread"] });
    qc.invalidateQueries({ queryKey: ["notifications-recent"] });
  };

  const generer = useMutation({
    mutationFn: () => genererAlertes(),
    onSuccess: (r) => {
      toast.success(`${r.created} alerte(s) générée(s) (${r.skipped} déjà présente(s))`);
      invalidate();
    },
    onError: (e: unknown) => toast.error(friendlyError(e, "Erreur génération")),
  });

  const allerLue = useMutation({
    mutationFn: () => markAllAsRead(),
    onSuccess: () => {
      toast.success("Toutes les notifications marquées comme lues");
      invalidate();
    },
  });

  const togglerLue = useMutation({
    mutationFn: ({ id, lu }: { id: string; lu: boolean }) => markAsRead(id, lu),
    onSuccess: invalidate,
  });

  const supprimer = useMutation({
    mutationFn: (id: string) => deleteNotification(id),
    onSuccess: () => {
      toast.success("Notification supprimée");
      invalidate();
    },
  });

  const purger = useMutation({
    mutationFn: () => deleteAllRead(),
    onSuccess: () => {
      toast.success("Notifications lues supprimées");
      invalidate();
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="ds-page-title flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" /> Notifications & alertes
          </h1>
          <p className="text-sm text-muted-foreground">Centre de notifications et alertes métier</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
          <Button variant="outline" onClick={() => generer.mutate()} disabled={generer.isPending}>
            <Wand2 className="mr-2 h-4 w-4" />
            {generer.isPending ? "Analyse…" : "Générer alertes"}
          </Button>
          <Button
            variant="outline"
            onClick={() => allerLue.mutate()}
            disabled={allerLue.isPending || stats.nonLus === 0}
          >
            <CheckCheck className="mr-2 h-4 w-4" />
            Tout marquer lu
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              const r = await confirm({
                title: "Purger les notifications lues ?",
                entityLabel: "toutes les notifications lues",
                description: "Toutes les notifications marquées comme lues seront supprimées définitivement.",
              });
              if (r === false) return;
              purger.mutate();
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Purger les lues
          </Button>
        </div>
      </div>

      <NotificationPreferencesPanel />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total affiché</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Non lues</p>
            <p className="text-2xl font-bold text-orange-600">{stats.nonLus}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-end gap-3">
            <div className="flex-1 space-y-1.5">
              <p className="text-xs text-muted-foreground">Type</p>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  {Object.entries(TYPE_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-1.5">
              <p className="text-xs text-muted-foreground">Statut</p>
              <Select value={luFilter} onValueChange={setLuFilter}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="non-lu">Non lu</SelectItem>
                  <SelectItem value="lu">Lu</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        {isLoading ? (
          <p className="py-8 text-center text-muted-foreground">Chargement…</p>
        ) : notifs.length === 0 ? (
          <EmptyState
            variant="rich"
            icon={Bell}
            title="Vous êtes à jour"
            description="Aucune notification à afficher. Les alertes stock, échéances et activités importantes s'afficheront ici."
          />
        ) : (
          notifs.map((n) => (
            <NotificationRow
              key={n.notification_id}
              n={n}
              onToggleLu={(lu) => togglerLue.mutate({ id: n.notification_id, lu })}
              onDelete={() => supprimer.mutate(n.notification_id)}
            />
          ))
        )}
      </div>
      {confirmDialog}
    </div>
  );
}

function NotificationRow({
  n,
  onToggleLu,
  onDelete,
}: {
  n: Notification;
  onToggleLu: (lu: boolean) => void;
  onDelete: () => void;
}) {
  const meta = TYPE_LABEL[n.type_notification] ?? TYPE_LABEL.info;
  return (
    <Card className={n.lu ? "opacity-70" : ""}>
      <CardContent className="flex items-start gap-3 p-4">
        <span
          className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: meta.color }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={`text-sm ${n.lu ? "font-medium" : "font-semibold"}`}>{n.titre}</p>
            <Badge variant="outline" style={{ color: meta.color, borderColor: meta.color }}>
              {meta.label}
            </Badge>
            {!n.lu && (
              <Badge variant="secondary" className="text-[10px]">
                Nouveau
              </Badge>
            )}
          </div>
          {n.message && <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>}
          <p className="mt-1 text-xs text-muted-foreground">{frDateTime(n.date_notification)}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            title={n.lu ? "Marquer non lu" : "Marquer lu"}
            onClick={() => onToggleLu(!n.lu)}
          >
            <Check className={`h-4 w-4 ${n.lu ? "text-muted-foreground" : "text-emerald-600"}`} />
          </Button>
          <Button variant="ghost" size="icon" title="Supprimer" onClick={onDelete} aria-label="Supprimer">
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
