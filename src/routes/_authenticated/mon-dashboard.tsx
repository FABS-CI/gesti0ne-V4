import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, RotateCcw } from "lucide-react";

import {
  WIDGETS,
  ALL_WIDGET_IDS,
  loadPrefs,
  savePrefs,
  type DashboardPrefs,
  type WidgetId,
} from "@/lib/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import { usePermissions } from "@/hooks/use-permissions";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

const SortableWidgetGrid = lazy(() => import("@/components/dashboard/SortableWidgetGrid"));

const SENSITIVE_WIDGETS: WidgetId[] = ["ca_mois", "paiements_recus_mois"];

export const Route = createFileRoute("/_authenticated/mon-dashboard")({
  component: MonDashboard,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function MonDashboard() {
  const { has } = usePermissions();
  const canSeeCA = has("dashboard.voir_ca");
  const allowedIds = useMemo(
    () => (canSeeCA ? ALL_WIDGET_IDS : ALL_WIDGET_IDS.filter((id) => !SENSITIVE_WIDGETS.includes(id))),
    [canSeeCA],
  );
  const [prefs, setPrefs] = useState<DashboardPrefs>({ order: ALL_WIDGET_IDS, hidden: [] });
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    setPrefs(loadPrefs());
  }, []);

  const update = (next: DashboardPrefs) => {
    setPrefs(next);
    savePrefs(next);
  };

  const visible = useMemo(
    () =>
      prefs.order.filter(
        (id) => !prefs.hidden.includes(id) && allowedIds.includes(id),
      ),
    [prefs, allowedIds],
  );

  const toggleHidden = (id: WidgetId) => {
    const hidden = prefs.hidden.includes(id)
      ? prefs.hidden.filter((x) => x !== id)
      : [...prefs.hidden, id];
    update({ ...prefs, hidden });
  };

  const reset = () => update({ order: ALL_WIDGET_IDS, hidden: [] });

  return (
    <div className="theme-dashboard p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="ds-page-title">Mon tableau de bord</h1>
          <p className="text-sm text-muted-foreground">
            Réorganisez et masquez les indicateurs selon vos besoins.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={reset}>
            <RotateCcw className="h-4 w-4 mr-2" /> Réinitialiser
          </Button>
          <Button
            variant={editMode ? "default" : "outline"}
            size="sm"
            onClick={() => setEditMode((v) => !v)}
          >
            {editMode ? "Terminer" : "Personnaliser"}
          </Button>
        </div>
      </div>

      {editMode && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium mb-3">Widgets disponibles</p>
            <div className="flex flex-wrap gap-2">
              {allowedIds.map((id) => {
                const hidden = prefs.hidden.includes(id);
                return (
                  <Button
                    key={id}
                    variant={hidden ? "outline" : "secondary"}
                    size="sm"
                    onClick={() => toggleHidden(id)}
                  >
                    {hidden ? (
                      <EyeOff className="h-3 w-3 mr-1.5" />
                    ) : (
                      <Eye className="h-3 w-3 mr-1.5" />
                    )}
                    {WIDGETS[id].title}
                  </Button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Glissez-déposez les cartes ci-dessous pour réorganiser.
            </p>
          </CardContent>
        </Card>
      )}

      {editMode ? (
        <Suspense
          fallback={
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {visible.map((id) => (
                <Skeleton key={id} className="h-32 w-full" />
              ))}
            </div>
          }
        >
          <SortableWidgetGrid
            visible={visible}
            editMode={editMode}
            onReorder={(order) => update({ ...prefs, order })}
          />
        </Suspense>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {visible.map((id) => (
            <WidgetCard key={id} id={id} editMode={false} />
          ))}
        </div>
      )}

      {visible.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Aucun widget affiché. Activez-en depuis « Personnaliser ».
          </CardContent>
        </Card>
      )}
    </div>
  );
}
