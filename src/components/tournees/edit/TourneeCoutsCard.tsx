import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatFCFA } from "@/lib/format";

import { Input } from "@/components/ui/input";
import { Field } from "./parts";
import { COST_FIELDS, type Tournee } from "./types";

export function TourneeCoutsCard({
  form,
  setField,
  coutTotal,
  canValidate,
}: {
  form: Tournee;
  setField: <K extends keyof Tournee>(k: K, v: Tournee[K]) => void;
  coutTotal: number;
  canValidate: boolean;
}) {
  const vs = form.validation_statut ?? "en_attente";
  const locked = !canValidate && (vs === "valide" || vs === "decaisse" || vs === "refuse");
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Coûts (FCFA)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {vs !== "en_attente" && (
          <div className="text-xs rounded bg-muted/40 border px-2 py-1">
            Statut : <b>{vs}</b>
            {locked && " — édition verrouillée"}
          </div>
        )}
        {COST_FIELDS.map((c) => (
          <Field key={String(c.key)} label={c.label}>
            <Input
              type="number"
              value={Number(form[c.key] ?? 0)}
              disabled={locked}
              onChange={(e) =>
                setField(c.key, (Number(e.target.value) || 0) as Tournee[typeof c.key])
              }
            />
          </Field>
        ))}
        <div className="flex items-center justify-between pt-2 border-t text-sm font-medium">
          <span>Total</span>
          <span className="tabular-nums">{formatFCFA(coutTotal, false)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
