import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw, Sticker } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getBalanceSticker, getFNEStats } from "@/lib/fne-api";

const FNE_ORANGE = "#FF6200";
const STICKER_SEUIL = 50;

function fmtDuration(s: number) {
  if (!s || !Number.isFinite(s)) return "0 s";
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m} min ${sec.toString().padStart(2, "0")} s`;
}

export function FNEDashboardTab() {
  const qc = useQueryClient();
  const { data: stats, isFetching: sf } = useQuery({
    queryKey: ["fne-stats"],
    queryFn: getFNEStats,
    staleTime: 120_000,
  });
  const { data: sticker, isFetching: kf } = useQuery({
    queryKey: ["fne-sticker"],
    queryFn: getBalanceSticker,
    staleTime: 300_000,
  });

  const stickerLow = sticker?.mode === "production" && (sticker.balance ?? 0) <= STICKER_SEUIL;

  return (
    <div className="space-y-6 pt-4">
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          disabled={sf || kf}
          onClick={() => {
            qc.invalidateQueries({ queryKey: ["fne-stats"] });
            qc.invalidateQueries({ queryKey: ["fne-sticker"] });
          }}
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${sf || kf ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {(
          [
            ["Total", stats?.total ?? 0, "#0A2540"],
            ["Certifiées", stats?.accepted ?? 0, "#10B981"],
            ["En attente", stats?.pending ?? 0, "#F59E0B"],
            ["En cours", stats?.submitted ?? 0, "#3B82F6"],
            ["Rejetées", stats?.rejected ?? 0, "#EF4444"],
            ["Erreur", stats?.error ?? 0, "#8B5CF6"],
            ["Taux réussite", `${stats?.success_rate ?? 0}%`, FNE_ORANGE],
          ] as const
        ).map(([lbl, val, color]) => (
          <Card key={lbl}>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground">{lbl}</div>
              <div className="text-2xl font-bold" style={{ color }}>
                {val}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className={stickerLow ? "border-destructive" : undefined}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sticker className="h-4 w-4" /> Stickers fiscaux
              {stickerLow && (
                <Badge variant="destructive" className="ml-2">
                  Seuil atteint
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sticker?.mode === "sandbox" ? (
              <div className="rounded border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
                <AlertTriangle className="h-4 w-4 inline mr-1" />
                {sticker.warning}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">Restants</div>
                  <div className="text-2xl font-bold">{sticker?.balance ?? 0}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Seuil alerte</div>
                  <div className="text-2xl font-bold text-warning">{STICKER_SEUIL}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">NCC</div>
                  <div className="text-sm font-mono pt-2">{sticker?.ncc ?? "—"}</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Temps moyen de traitement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {fmtDuration(stats?.avg_processing_seconds ?? 0)}
            </div>
            <div className="text-xs text-muted-foreground">Moyenne soumission → certification</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
