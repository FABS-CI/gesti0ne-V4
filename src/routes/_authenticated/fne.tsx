import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  FileText,
  LayoutDashboard,
  Receipt,
  Settings as SettingsIcon,
  ShieldCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getBalanceSticker } from "@/lib/fne-api";
import { FNELogsPanel } from "@/components/fne/FNELogsPanel";
import { FNESettingsPanel } from "@/components/fne/FNESettingsPanel";
import { FNEDashboardTab } from "@/components/fne/FNEDashboardTab";
import { FNEFacturesTab } from "@/components/fne/FNEFacturesTab";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

type FNETab = "dashboard" | "factures" | "logs" | "settings";

export const Route = createFileRoute("/_authenticated/fne")({
  component: FNEModule,
  validateSearch: (s: Record<string, unknown>): { tab?: FNETab } => {
    const t = s.tab;
    if (t === "dashboard" || t === "factures" || t === "logs" || t === "settings")
      return { tab: t };
    return {};
  },
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

const FNE_ORANGE = "#FF6200";

function FNEModule() {
  const search = useSearch({ from: "/_authenticated/fne" });
  const nav = useNavigate();
  const [tab, setTabState] = useState<FNETab>(search.tab ?? "dashboard");
  useEffect(() => {
    if (search.tab && search.tab !== tab) setTabState(search.tab);
  }, [search.tab, tab]);
  const setTab = (v: string) => {
    setTabState(v as FNETab);
    nav({ to: "/fne", search: { tab: v as FNETab }, replace: true });
  };
  const { data: sticker } = useQuery({ queryKey: ["fne-sticker"], queryFn: getBalanceSticker });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-8 w-8" style={{ color: FNE_ORANGE }} />
          <div>
            <h1 className="ds-page-title">FNE — Facture Normalisée Électronique</h1>
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              Certification DGI Côte d'Ivoire —{" "}
              {sticker?.mode === "sandbox" ? (
                <Badge variant="secondary">SANDBOX</Badge>
              ) : (
                <Badge style={{ backgroundColor: "#10B981", color: "#fff" }}>PRODUCTION</Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="dashboard">
            <LayoutDashboard className="h-4 w-4 mr-1" />
            Tableau de bord
          </TabsTrigger>
          <TabsTrigger value="factures">
            <Receipt className="h-4 w-4 mr-1" />
            Factures FNE
          </TabsTrigger>
          <TabsTrigger value="logs">
            <FileText className="h-4 w-4 mr-1" />
            Historique
          </TabsTrigger>
          <TabsTrigger value="settings">
            <SettingsIcon className="h-4 w-4 mr-1" />
            Paramètres
          </TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard">
          <FNEDashboardTab />
        </TabsContent>
        <TabsContent value="factures">
          <FNEFacturesTab />
        </TabsContent>
        <TabsContent value="logs">
          <FNELogsPanel />
        </TabsContent>
        <TabsContent value="settings">
          <FNESettingsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
