import { formatDocumentReference } from "@/lib/document-reference";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Kpi } from "./shared";
import { frDate } from "@/lib/client-detail-helpers";
import { formatFCFA } from "@/lib/format";
import type { ClientRelations } from "@/lib/clients-api";
import { useNavigate } from "@tanstack/react-router";

interface ClientCompteTabProps {
  caFacture: number;
  totalPaye: number;
  encours: number;
  plafond: number;
  tauxCredit: number;
  facturesImpayees: ClientRelations["factures"];
}

export function ClientCompteTab({
  caFacture,
  totalPaye,
  encours,
  plafond,
  tauxCredit,
  facturesImpayees,
}: ClientCompteTabProps) {
  const navigate = useNavigate();
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi label="Total facturé" value={formatFCFA(caFacture)} />
        <Kpi label="Total encaissé" value={formatFCFA(totalPaye)} accent="text-emerald-600" />
        <Kpi
          label="Solde dû"
          value={formatFCFA(Math.max(0, caFacture - totalPaye))}
          accent={caFacture - totalPaye > 0 ? "text-red-600" : "text-emerald-600"}
        />
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Limite de crédit</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">Encours</span>
            <span className="font-semibold">
              {formatFCFA(encours)} / {formatFCFA(plafond)}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted">
            <div
              className={`h-2 rounded-full ${tauxCredit > 90 ? "bg-red-500" : tauxCredit > 70 ? "bg-amber-500" : "bg-emerald-500"}`}
              style={{ width: `${tauxCredit}%` }}
            />
          </div>
        </CardContent>
      </Card>
      {facturesImpayees.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-red-600">
              <AlertTriangle className="h-4 w-4" />
              {facturesImpayees.length} facture(s) impayée(s)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {facturesImpayees.map((f) => (
              <button
                key={f.facture_id}
                type="button"
                onClick={() =>
                  navigate({ to: "/factures/$factureId", params: { factureId: f.facture_id } })
                }
                className="flex w-full items-center justify-between rounded px-2 py-1 text-sm hover:bg-muted"
              >
                <span className="font-mono text-xs">{formatDocumentReference(f.reference)}</span>
                <span className="text-muted-foreground">{frDate(f.date_facture)}</span>
                <span className="font-semibold text-red-600">
                  {formatFCFA(Number(f.montant_total) - Number(f.montant_paye))}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
