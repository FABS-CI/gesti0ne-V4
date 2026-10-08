import { useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Inbox } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  listNotifications,
  countUnread,
  markAllAsRead,
  markAsRead,
  TYPE_LABEL,
  type Notification,
} from "@/lib/notifications-api";

export function NotificationsBell() {
  const qc = useQueryClient();
  const nav = useNavigate();

  const { data: unread = 0 } = useQuery({
    queryKey: ["notifications-unread"],
    queryFn: countUnread,
    // Pas de polling : la souscription realtime ci-dessous invalide
    // automatiquement le cache dès qu'une notification change.
    staleTime: 60_000,
  });

  const { data: items = [] } = useQuery({
    queryKey: ["notifications-recent"],
    queryFn: () => listNotifications({ limit: 8 }),
    staleTime: 60_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel("notifications-bell")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => {
        qc.invalidateQueries({ queryKey: ["notifications-unread"] });
        qc.invalidateQueries({ queryKey: ["notifications-recent"] });
        qc.invalidateQueries({ queryKey: ["notifications"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const handleOpen = async (n: Notification) => {
    if (!n.lu) {
      await markAsRead(n.notification_id, true);
      qc.invalidateQueries({ queryKey: ["notifications-unread"] });
      qc.invalidateQueries({ queryKey: ["notifications-recent"] });
    }
    if (n.lien) nav({ to: n.lien }).catch(() => {});
  };

  const handleMarkAll = async () => {
    await markAllAsRead();
    qc.invalidateQueries({ queryKey: ["notifications-unread"] });
    qc.invalidateQueries({ queryKey: ["notifications-recent"] });
  };

  const display = unread > 99 ? "99+" : String(unread);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative h-10 w-10 rounded-lg"
          aria-label="Notifications"
        >
          <Bell className="h-[18px] w-[18px]" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1 text-xs font-bold text-white ring-2 ring-card">
              {display}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0">
        <div className="flex items-center justify-between border-b p-3">
          <p className="font-semibold text-sm">Notifications</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMarkAll}
            disabled={unread === 0}
            className="h-7 px-2 text-xs"
          >
            <CheckCheck className="h-3.5 w-3.5 mr-1" />
            Tout marquer lu
          </Button>
        </div>
        <ScrollArea className="max-h-[420px]">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <Inbox className="h-8 w-8 opacity-40" />
              <p className="text-sm">Aucune notification</p>
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((n) => {
                const meta = TYPE_LABEL[n.type_notification] ?? TYPE_LABEL.info;
                return (
                  <li
                    key={n.notification_id}
                    className={`p-3 hover:bg-muted/50 cursor-pointer transition-colors ${
                      !n.lu ? "bg-primary/5" : ""
                    }`}
                    onClick={() => handleOpen(n)}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className="mt-1.5 h-2 w-2 rounded-full shrink-0"
                        style={{ background: meta.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{n.titre}</p>
                          {!n.lu && (
                            <Badge variant="secondary" className="text-xs h-4 px-1">
                              Nouveau
                            </Badge>
                          )}
                        </div>
                        {n.message && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                            {n.message}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(n.created_at), {
                            addSuffix: true,
                            locale: fr,
                          })}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
        <div className="border-t p-2">
          <Button asChild variant="ghost" size="sm" className="w-full justify-center text-xs">
            <Link to="/notifications">Voir toutes les notifications</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
