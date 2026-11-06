import { getCurrentUser } from "@/lib/current-user";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  invalidatePrefsCache,
  loadPrefs,
  useNotificationSound,
  MELODIES,
  type NotificationPrefs,
} from "@/hooks/use-notification-sound";

const MODULES = [
  "commandes",
  "colisage",
  "livraisons",
  "factures",
  "paiements",
  "stock",
  "achats",
  "rh",
  "administration",
];

export function NotificationPreferencesPanel() {
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [saving, setSaving] = useState(false);
  const { play } = useNotificationSound();
  const previewTimerRef = useRef<number | null>(null);

  const previewVolume = (v: number, melodie: string) => {
    if (previewTimerRef.current) window.clearTimeout(previewTimerRef.current);
    previewTimerRef.current = window.setTimeout(() => {
      play(undefined, melodie, v);
    }, 120);
  };

  useEffect(() => {
    invalidatePrefsCache();
    loadPrefs().then(setPrefs);
  }, []);

  if (!prefs) return null;

  const save = async (next: NotificationPrefs) => {
    setPrefs(next);
    setSaving(true);
    const { data: auth } = await getCurrentUser();
    if (!auth.user) {
      setSaving(false);
      return;
    }
    const { error } = await supabase
      .from("notification_preferences" as never)
      .upsert({ user_id: auth.user.id, ...next } as never);
    setSaving(false);
    if (error) toast.error("Erreur lors de la sauvegarde");
    invalidatePrefsCache();
  };

  const askBrowser = async () => {
    if (!("Notification" in window)) {
      toast.error("Notifications navigateur non supportées");
      return;
    }
    const p = await Notification.requestPermission();
    if (p === "granted") {
      save({ ...prefs, notifs_navigateur: true });
      toast.success("Notifications navigateur activées");
    } else {
      toast.error("Permission refusée");
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          Mes préférences de notification
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Label className="cursor-pointer">Alerte sonore</Label>
          </div>
          <Switch
            checked={prefs.son_actif}
            onCheckedChange={(v) => save({ ...prefs, son_actif: v })}
            disabled={saving}
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <Label>Volume</Label>
            <span className="text-muted-foreground text-xs">{prefs.volume}%</span>
          </div>
          <div className="flex items-center gap-2">
            <Slider
              value={[prefs.volume]}
              min={0}
              max={100}
              step={5}
              disabled={!prefs.son_actif || saving}
              onValueChange={([v]) => {
                setPrefs({ ...prefs, volume: v });
                previewVolume(v, prefs.son_notification);
              }}
              onValueCommit={([v]) => save({ ...prefs, volume: v })}
            />
            <Button
              aria-label="Tester"
              size="sm"
              variant="outline"
              onClick={() => play()}
              title="Tester"
            >
              Tester
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-sm">Mélodie de notification</Label>
          <div className="flex items-center gap-2">
            <Select
              value={prefs.son_notification}
              onValueChange={(v) =>
                save({ ...prefs, son_notification: v as NotificationPrefs["son_notification"] })
              }
              disabled={saving}
            >
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MELODIES.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              aria-label="Écouter"
              size="sm"
              variant="outline"
              onClick={() => play(undefined, prefs.son_notification)}
              title="Écouter"
              disabled={!prefs.son_actif}
            >
              Écouter
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Une mélodie par défaut est attribuée à chaque utilisateur. Vous pouvez la changer à tout
            moment.
          </p>
        </div>
        <div className="flex items-center justify-between">
          <Label>Notifications système du navigateur</Label>
          {prefs.notifs_navigateur ? (
            <Switch checked onCheckedChange={(v) => save({ ...prefs, notifs_navigateur: v })} />
          ) : (
            <Button size="sm" variant="outline" onClick={askBrowser}>
              Activer
            </Button>
          )}
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase">
            Désactiver certains modules
          </Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {MODULES.map((m) => {
              const off = prefs.modules_desactives.includes(m);
              return (
                <label key={m} className="flex items-center gap-2 text-sm capitalize">
                  <Checkbox
                    checked={!off}
                    onCheckedChange={(v) => {
                      const next = v
                        ? prefs.modules_desactives.filter((x) => x !== m)
                        : [...prefs.modules_desactives, m];
                      save({ ...prefs, modules_desactives: next });
                    }}
                  />
                  {m}
                </label>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
