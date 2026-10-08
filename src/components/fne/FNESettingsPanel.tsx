import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Save, Wifi, FlaskConical, RotateCcw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { loadFNESettings, updateFNESetting, pingDGI, submitFNEInvoice } from "@/lib/fne-api";
import { usePermissions } from "@/hooks/use-permissions";
import { friendlyError } from "@/lib/friendly-error";

const SECTIONS: { title: string; fields: [string, string, ("password" | "text" | "number")?][] }[] =
  [
    {
      title: "Connexion DGI",
      fields: [
        ["dgi_api_url_test", "URL API DGI (test)"],
        ["dgi_api_url_prod", "URL API DGI (production)"],
        ["company_ncc", "NCC entreprise"],
        ["company_idu", "N° du télédéclarant (IDU)"],
        ["use_production", "Mode production (true / false)"],
      ],
    },
    {
      title: "Entreprise",
      fields: [
        ["company_name", "Raison sociale"],
        ["company_rccm", "RCCM"],
        ["company_compte_contribuable", "Compte contribuable"],
        ["company_adresse", "Adresse"],
        ["company_telephone", "Téléphone"],
        ["company_email", "Email"],
        ["company_regime", "Régime fiscal"],
        ["company_secteur", "Secteur"],
        ["company_dran", "DRAN"],
        ["company_centre_impots", "Centre des impôts"],
        ["point_of_sale", "Point de vente"],
        ["establishment", "Établissement"],
      ],
    },
    {
      title: "Certificat numérique",
      fields: [
        ["certificat_numero", "N° / Empreinte du certificat"],
        ["certificat_expiration", "Date d'expiration (AAAA-MM-JJ)"],
        ["certificat_emetteur", "Émetteur"],
      ],
    },
    {
      title: "Paramètres techniques",
      fields: [
        ["timeout_ms", "Timeout (ms)", "number"],
        ["max_retries", "Nombre maximal de tentatives", "number"],
        ["sync_auto", "Synchronisation automatique (true / false)"],
        ["logs_detail", "Logs détaillés (true / false)"],
      ],
    },
    {
      title: "Stickers",
      fields: [
        ["stickers_total", "Stock total stickers", "number"],
        ["stickers_seuil_alerte", "Seuil d'alerte", "number"],
        ["stickers_alertes_dashboard", "Afficher alertes Dashboard (true / false)"],
      ],
    },
  ];

export function FNESettingsPanel() {
  const qc = useQueryClient();
  const { has } = usePermissions();
  const canEdit = has("fne.modifier_parametres");
  const { data: settings = {} } = useQuery({
    queryKey: ["fne-settings"],
    queryFn: loadFNESettings,
  });
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [pingResult, setPingResult] = useState<string>("");
  const [testResult, setTestResult] = useState<string>("");
  const [certResult, setCertResult] = useState<string>("");

  const save = useMutation({
    mutationFn: async () => {
      for (const [k, v] of Object.entries(draft)) {
        if (k === "dgi_api_key" && !v) continue;
        await updateFNESetting(k, v);
      }
    },
    onSuccess: () => {
      toast.success("Paramètres enregistrés");
      setEdit(false);
      setDraft({});
      qc.invalidateQueries({ queryKey: ["fne-settings"] });
      qc.invalidateQueries({ queryKey: ["fne-sticker"] });
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  const val = (k: string) => draft[k] ?? settings[k] ?? "";

  const runPing = async () => {
    const r = await pingDGI();
    setPingResult(`${r.ok ? "" : ""} ${r.message} (${r.elapsed_ms} ms)`);
  };

  const runCertCheck = () => {
    const exp = (draft.certificat_expiration ?? settings.certificat_expiration ?? "").trim();
    if (!exp) {
      setCertResult(" Aucune date d'expiration configurée");
      return;
    }
    const d = new Date(exp);
    if (Number.isNaN(d.getTime())) {
      setCertResult(" Date invalide (format AAAA-MM-JJ)");
      return;
    }
    const days = Math.floor((d.getTime() - Date.now()) / 86400000);
    if (days < 0) setCertResult(` Certificat expiré depuis ${Math.abs(days)} j`);
    else if (days <= 30) setCertResult(`! Certificat expire dans ${days} j`);
    else setCertResult(` Certificat valide (${days} j restants)`);
  };

  const runTest = async (template: "B2C" | "B2B" | "B2G") => {
    setTestResult("…");
    try {
      const r = await submitFNEInvoice({
        template,
        paymentMethod: "cash",
        clientCompanyName: `Test ${template}`,
        clientPhone: "+225 0000 0000",
        clientNcc: template === "B2B" ? "0000000T" : null,
        items: [
          {
            reference: "TEST",
            description: `Test ${template}`,
            quantity: undefined as any,
            amount: 1000,
            taxes: ["TVA"],
          },
        ],
      });
      setTestResult(` Certifiée — code ${r.code_dgi}`);
    } catch (e) {
      setTestResult(` ${(e as Error).message}`);
    }
  };

  return (
    <div className="pt-4 space-y-4">
      <div className="flex items-center justify-between">
        <Badge variant={settings.use_production === "true" ? "default" : "secondary"}>
          {settings.use_production === "true" ? "PRODUCTION" : "SANDBOX"}
        </Badge>
        {canEdit ? (
          edit ? (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setDraft({})}>
                <RotateCcw className="h-4 w-4 mr-1" />
                Restaurer
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEdit(false);
                  setDraft({});
                }}
              >
                Annuler
              </Button>
              <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
                <Save className="h-4 w-4 mr-1" />
                Enregistrer
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={() => setEdit(true)}>
              Modifier
            </Button>
          )
        ) : null}
      </div>

      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="tests">Tests API DGI</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          {SECTIONS.map((sec) => (
            <Card key={sec.title}>
              <CardHeader>
                <CardTitle className="text-base">{sec.title}</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {sec.fields.map(([k, label, kind]) => {
                  const isSecret = kind === "password";
                  const display = isSecret
                    ? settings[k]
                      ? `${settings[k].slice(0, 4)}••••${settings[k].slice(-2)}`
                      : "(non configuré)"
                    : settings[k] || "—";
                  return (
                    <div key={k}>
                      <Label className="text-xs">{label}</Label>
                      {edit ? (
                        <Input
                          type={kind ?? "text"}
                          value={isSecret ? (draft[k] ?? "") : val(k)}
                          placeholder={isSecret ? "(vide = inchangé)" : ""}
                          onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
                        />
                      ) : (
                        <div className="text-sm font-mono p-2 bg-muted rounded">{display}</div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={runPing}>
                  <Wifi className="h-4 w-4 mr-1" />
                  Tester la connexion DGI
                </Button>
                <Button variant="outline" size="sm" onClick={runCertCheck}>
                  <ShieldCheck className="h-4 w-4 mr-1" />
                  Vérifier le certificat
                </Button>
              </div>
              {pingResult && <div className="mt-2 text-sm font-mono">{pingResult}</div>}
              {certResult && <div className="mt-1 text-sm font-mono">{certResult}</div>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tests">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tests API DGI</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded border border-info/40 bg-info/10 p-3 text-sm text-info">
                Environnement : {settings.use_production === "true" ? "PRODUCTION" : "SANDBOX"}.{" "}
                {!settings.dgi_api_key &&
                  "! Bearer Token non configuré — les tests s'exécutent en mode simulé."}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {(["B2C", "B2B", "B2G"] as const).map((t) => (
                  <Card key={t}>
                    <CardContent className="pt-4 space-y-2">
                      <div className="font-semibold flex items-center gap-2">
                        <FlaskConical className="h-4 w-4" />
                        Facture {t}
                      </div>
                      <Button size="sm" className="w-full" onClick={() => runTest(t)}>
                        Lancer le test
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {testResult && <pre className="bg-muted p-3 rounded text-xs">{testResult}</pre>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
